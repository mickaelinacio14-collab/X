
let clients=[], transactions=[], reminders=[], settings={tradeDiscount:30};
let selectedClient=null, scene, camera, renderer, spheres=[];

const $=s=>document.querySelector(s);
const money=n=>(Number(n)||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function api(url,options){
  const r=await fetch(url,options);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"),2600);
}
function statusBadge(s){
  const map={prospect:"prospect",actif:"actif",inactif:"inactif",vente:"vente",achat:"achat",trade:"trade",termine:"termine",encours:"encours"};
  return `<span class="badge ${map[s]||"a-faire"}">${esc(s||"à faire")}</span>`;
}

document.querySelectorAll("nav button").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    $("#view-"+b.dataset.view).classList.add("active");
    if(b.dataset.view==="3d") init3D();
  };
});

async function loadAll(){
  [clients,transactions,reminders,settings]=await Promise.all([
    api("/api/clients"),api("/api/transactions"),api("/api/reminders"),api("/api/settings")
  ]);
  renderStats();renderClients();renderTransactions();renderReminders();
}

async function renderStats(){
  const s=await api("/api/stats");
  $("#stats-cards").innerHTML=`
    <div class="stat"><span>Clients</span><strong>${s.clients}</strong></div>
    <div class="stat"><span>Prospects</span><strong>${s.prospects}</strong></div>
    <div class="stat"><span>CA total</span><strong>${money(s.revenue)}</strong></div>
    <div class="stat"><span>CA du mois</span><strong>${money(s.monthlyRevenue)}</strong></div>
    <div class="stat"><span>Marge ventes</span><strong>${money(s.profit)}</strong></div>
    <div class="stat"><span>Trades</span><strong>${s.trades}</strong></div>`;
  $("#top-cards").innerHTML=s.topCards.length?s.topCards.map(c=>`
    <div class="item"><div><strong>${esc(c.name)}</strong><small>Chiffre d'affaires</small></div><strong>${money(c.total)}</strong></div>`).join("")
    :`<p class="muted">Aucune vente enregistrée.</p>`;
}

function clientName(id){
  const c=clients.find(x=>x.id==id);
  return c?c.name:"—";
}
function renderClients(){
  const q=($("#client-search").value||"").toLowerCase();
  const st=$("#client-status").value;
  const list=clients.filter(c=>
    (!q||c.name.toLowerCase().includes(q)||c.city.toLowerCase().includes(q))&&(!st||c.status===st)
  );
  $("#clients-list").innerHTML=list.length?list.map(c=>`
    <div class="item">
      <div><strong>${esc(c.name)}</strong><small>${esc(c.city||"Ville non renseignée")} · ${esc(c.phone||c.email||"Sans contact")}</small></div>
      <div class="actions">${statusBadge(c.status)}
        <button onclick='openClientModal(${c.id})'>Modifier</button>
        <button class="danger" onclick='deleteClient(${c.id})'>Supprimer</button>
      </div>
    </div>`).join(""):`<p class="muted">Aucun client.</p>`;
}
function openClientModal(id=null){
  const c=clients.find(x=>x.id==id)||{};
  $("#modal-title").textContent=c.id?"Modifier le client":"Nouveau client";
  $("#modal-body").innerHTML=`
    <div class="form-grid">
      <div><label>Nom</label><input id="f-name" value="${esc(c.name||"")}"></div>
      <div><label>Ville</label><input id="f-city" value="${esc(c.city||"")}"></div>
      <div><label>Téléphone</label><input id="f-phone" value="${esc(c.phone||"")}"></div>
      <div><label>E-mail</label><input id="f-email" value="${esc(c.email||"")}"></div>
      <div><label>Statut</label>
        <select id="f-status">
          <option value="prospect">Prospect</option>
          <option value="actif">Client actif</option>
          <option value="inactif">Client inactif</option>
        </select>
      </div>
      <div><label>Cartes recherchées</label><input id="f-wanted" value="${esc(c.wantedCards||"")}"></div>
      <div class="full"><label>Notes</label><textarea id="f-notes">${esc(c.notes||"")}</textarea></div>
    </div>
    <br><button class="primary" onclick="saveClient(${c.id||"null"})">Enregistrer</button>`;
  $("#f-status").value=c.status||"prospect";
  $("#modal").classList.remove("hidden");
}
async function saveClient(id){
  const body={
    name:$("#f-name").value,city:$("#f-city").value,phone:$("#f-phone").value,
    email:$("#f-email").value,status:$("#f-status").value,
    wantedCards:$("#f-wanted").value,notes:$("#f-notes").value
  };
  if(id) await api("/api/clients/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  else await api("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  closeModal();await loadAll();toast("Client enregistré");
}
async function deleteClient(id){
  if(!confirm("Supprimer ce client et ses opérations ?"))return;
  await api("/api/clients/"+id,{method:"DELETE"});await loadAll();toast("Client supprimé");
}

function renderTransactions(){
  const q=($("#transaction-search").value||"").toLowerCase();
  const type=$("#transaction-type").value;
  const list=transactions.filter(t=>
    (!q||t.cardName.toLowerCase().includes(q)||clientName(t.clientId).toLowerCase().includes(q))&&(!type||t.type===type)
  );
  $("#transactions-list").innerHTML=list.length?list.map(t=>`
    <div class="item">
      <div><strong>${esc(t.cardName||"Carte non précisée")}</strong>
      <small>${esc(clientName(t.clientId))} · ${esc(t.date)} · ${money(t.amount)}</small></div>
      <div class="actions">${statusBadge(t.type)} ${statusBadge(t.status)}
        <button onclick='openTransactionModal(${t.id})'>Modifier</button>
        <button class="danger" onclick='deleteTransaction(${t.id})'>Supprimer</button>
      </div>
    </div>`).join(""):`<p class="muted">Aucune opération.</p>`;
}
function openTransactionModal(id=null){
  const t=transactions.find(x=>x.id==id)||{};
  $("#modal-title").textContent=t.id?"Modifier l’opération":"Nouvelle opération";
  $("#modal-body").innerHTML=`
    <div class="form-grid">
      <div><label>Client</label>
        <select id="t-client"><option value="">—</option>
        ${clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
        </select></div>
      <div><label>Type</label>
        <select id="t-type">
          <option value="vente">Vente</option>
          <option value="achat">Rachat</option>
          <option value="trade">Trade</option>
        </select></div>
      <div><label>Montant reçu / prix de vente</label><input id="t-amount" type="number" step="0.01" value="${t.amount||""}"></div>
      <div><label>Coût / valeur d’achat</label><input id="t-cost" type="number" step="0.01" value="${t.cost||""}"></div>
      <div><label>Date</label><input id="t-date" type="date" value="${t.date||new Date().toISOString().slice(0,10)}"></div>
      <div><label>Statut</label>
        <select id="t-status">
          <option value="termine">Terminé</option>
          <option value="encours">En cours</option>
        </select></div>
      <div class="full"><label>Rechercher une carte Pokémon</label>
        <div style="display:flex;gap:8px">
          <input id="t-search-name" placeholder="Nom : Pikachu">
          <input id="t-search-num" placeholder="Numéro : 4/102">
          <button onclick="searchCard()">Chercher</button>
        </div>
        <div id="card-results" class="search-results"></div>
      </div>
      <div class="full"><label>Notes</label><textarea id="t-notes">${esc(t.notes||"")}</textarea></div>
    </div>
    <br><button class="primary" onclick="saveTransaction(${t.id||"null"})">Enregistrer</button>`;
  $("#t-client").value=t.clientId||"";
  $("#t-type").value=t.type||"vente";
  $("#t-status").value=t.status||"termine";
  window.currentCard={name:t.cardName||"",number:t.cardNumber||"",image:t.cardImage||"",logo:t.setLogo||""};
  $("#modal").classList.remove("hidden");
}
async function searchCard(){
  const name=$("#t-search-name").value.trim();
  const num=$("#t-search-num").value.trim();
  if(!name)return toast("Indique un nom de carte");
  $("#card-results").innerHTML=`<p class="muted">Recherche...</p>`;
  const data=await api(`/api/titre?nom=${encodeURIComponent(name)}&num=${encodeURIComponent(num)}`);
  if(!data.resultats.length)return $("#card-results").innerHTML=`<p class="muted">Aucune carte trouvée.</p>`;
  $("#card-results").innerHTML=data.resultats.map((c,i)=>`
    <div class="result" onclick='selectCard(${i})'>
      ${c.image?`<img src="${c.image}">`:""}
      <div><strong>${esc(c.titre)}</strong><small>${esc(c.id)}</small></div>
    </div>`).join("");
  window.searchResults=data.resultats;
}
function selectCard(i){
  const c=window.searchResults[i];
  window.currentCard={name:c.name,number:c.numero,image:c.image||"",logo:c.serieLogo||""};
  $("#card-results").innerHTML=`<div class="result"><strong>Carte sélectionnée :</strong> ${esc(c.titre)}</div>`;
}
async function saveTransaction(id){
  const body={
    clientId:$("#t-client").value,type:$("#t-type").value,
    cardName:window.currentCard.name,cardNumber:window.currentCard.number,
    cardImage:window.currentCard.image,setLogo:window.currentCard.logo,
    amount:$("#t-amount").value,cost:$("#t-cost").value,
    date:$("#t-date").value,status:$("#t-status").value,notes:$("#t-notes").value
  };
  if(id) await api("/api/transactions/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  else await api("/api/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  closeModal();await loadAll();toast("Opération enregistrée");
}
async function deleteTransaction(id){
  if(!confirm("Supprimer cette opération ?"))return;
  await api("/api/transactions/"+id,{method:"DELETE"});await loadAll();toast("Opération supprimée");
}

function renderReminders(){
  const today=new Date().toISOString().slice(0,10);
  $("#reminders-list").innerHTML=reminders.length?reminders.map(r=>`
    <div class="item">
      <div><strong>${esc(r.title)}</strong>
      <small>${esc(clientName(r.clientId))} · ${esc(r.date)} ${r.date<today&&!r.done?"· EN RETARD":""}</small></div>
      <div class="actions">${r.done?statusBadge("termine"):statusBadge("a-faire")}
        <button onclick='toggleReminder(${r.id})'>${r.done?"Rouvrir":"Terminer"}</button>
        <button class="danger" onclick='deleteReminder(${r.id})'>Supprimer</button>
      </div>
    </div>`).join(""):`<p class="muted">Aucune relance.</p>`;
}
function openReminderModal(){
  $("#modal-title").textContent="Nouvelle relance";
  $("#modal-body").innerHTML=`
    <div class="form-grid">
      <div><label>Client</label>
        <select id="r-client"><option value="">—</option>
        ${clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
        </select></div>
      <div><label>Date</label><input id="r-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="full"><label>Objet</label><input id="r-title" value="Relance client"></div>
      <div class="full"><label>Notes</label><textarea id="r-notes"></textarea></div>
    </div>
    <br><button class="primary" onclick="saveReminder()">Enregistrer</button>`;
  $("#modal").classList.remove("hidden");
}
async function saveReminder(){
  await api("/api/reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    clientId:$("#r-client").value,title:$("#r-title").value,date:$("#r-date").value,notes:$("#r-notes").value
  })});
  closeModal();await loadAll();toast("Relance créée");
}
async function toggleReminder(id){
  const r=reminders.find(x=>x.id==id);
  await api("/api/reminders/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({done:!r.done})});
  await loadAll();
}
async function deleteReminder(id){
  if(!confirm("Supprimer cette relance ?"))return;
  await api("/api/reminders/"+id,{method:"DELETE"});await loadAll();
}

function closeModal(){$("#modal").classList.add("hidden")}

function init3D(){
  const container=$("#scene3d");
  if(!scene){
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(60,container.clientWidth/container.clientHeight,.1,2000);
    camera.position.set(0,55,135);
    renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(container.clientWidth,container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff,.55));
    const l1=new THREE.PointLight(0x31d7ff,2.2,500);l1.position.set(90,90,90);scene.add(l1);
    const l2=new THREE.PointLight(0x8b5cf6,1.8,500);l2.position.set(-90,50,-90);scene.add(l2);

    const grid=new THREE.GridHelper(420,42,0x223052,0x14203a);
    grid.position.y=-35;scene.add(grid);

    const animate=()=>{
      requestAnimationFrame(animate);
      spheres.forEach(s=>{s.rotation.y+=.004;s.position.y+=Math.sin(Date.now()*.001+s.userData.seed)*.045});
      renderer.render(scene,camera);
    };
    animate();
    window.addEventListener("resize",()=>{
      camera.aspect=container.clientWidth/container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth,container.clientHeight);
    });
    renderer.domElement.addEventListener("click",onSceneClick);
  }
  buildGalaxy();
}

function buildGalaxy(){
  spheres.forEach(s=>scene.remove(s));
  spheres=[];
  const colors={prospect:0x31d7ff,actif:0x22c55e,inactif:0x94a3b8};
  clients.forEach((c,i)=>{
    const activity=transactions.filter(t=>t.clientId==c.id).length;
    const radius=2.2+Math.min(activity,10)*.45;
    const color=colors[c.status]||0x8b5cf6;
    const geo=new THREE.SphereGeometry(radius,32,32);
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.35,metalness:.25});
    const mesh=new THREE.Mesh(geo,mat);
    const angle=(i/Math.max(clients.length,1))*Math.PI*2;
    const ring=25+(i%5)*16;
    mesh.position.set(Math.cos(angle)*ring,Math.sin(i)*7,Math.sin(angle)*ring);
    mesh.userData={clientId:c.id,seed:i};
    scene.add(mesh);spheres.push(mesh);
  });
}

function onSceneClick(event){
  const rect=renderer.domElement.getBoundingClientRect();
  const mouse=new THREE.Vector2(
    ((event.clientX-rect.left)/rect.width)*2-1,
    -((event.clientY-rect.top)/rect.height)*2+1
  );
  const ray=new THREE.Raycaster();
  ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(spheres);
  if(!hits.length)return;
  const client=clients.find(c=>c.id==hits[0].object.userData.clientId);
  if(client)showClient3D(client);
}

function showClient3D(c){
  const list=transactions.filter(t=>t.clientId==c.id);
  const total=list.reduce((s,t)=>s+(t.amount||0),0);
  $("#client3d-panel").innerHTML=`
    <div style="display:flex;justify-content:space-between"><h3>${esc(c.name)}</h3><button onclick="document.querySelector('#client3d-panel').classList.add('hidden')">✕</button></div>
    <p class="muted">${esc(c.city||"")} · ${esc(c.status)}</p>
    <p><strong>${list.length}</strong> opérations · <strong>${money(total)}</strong></p>
    <p class="muted">Cartes recherchées : ${esc(c.wantedCards||"—")}</p>
    <button class="primary" onclick='openClientModal(${c.id})'>Modifier la fiche</button>`;
  $("#client3d-panel").classList.remove("hidden");
}

loadAll();

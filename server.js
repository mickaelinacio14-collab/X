
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "crm.json");
const API = "https://api.tcgdex.net/v2/fr";
const cache = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    clients: [],
    transactions: [],
    reminders: [],
    settings: { tradeDiscount: 30, shopName: "Mickey Kingdom TCG" }
  }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function nextId(list) {
  return list.length ? Math.max(...list.map(x => Number(x.id) || 0)) + 1 : 1;
}

async function get(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  cache.set(url, data);
  return data;
}

function pad(id, total) {
  return /^\d+$/.test(String(id)) && total
    ? String(id).padStart(String(total).length, "0")
    : String(id);
}

app.get("/api/settings", (req, res) => {
  res.json(readDB().settings);
});

app.put("/api/settings", (req, res) => {
  const db = readDB();
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);
  res.json(db.settings);
});

app.get("/api/clients", (req, res) => {
  res.json(readDB().clients);
});

app.post("/api/clients", (req, res) => {
  const db = readDB();
  const client = {
    id: nextId(db.clients),
    name: req.body.name || "Sans nom",
    phone: req.body.phone || "",
    email: req.body.email || "",
    city: req.body.city || "",
    status: req.body.status || "prospect",
    notes: req.body.notes || "",
    wantedCards: req.body.wantedCards || "",
    createdAt: new Date().toISOString()
  };
  db.clients.push(client);
  writeDB(db);
  res.status(201).json(client);
});

app.put("/api/clients/:id", (req, res) => {
  const db = readDB();
  const client = db.clients.find(c => c.id == req.params.id);
  if (!client) return res.status(404).json({ error: "Client introuvable" });
  Object.assign(client, req.body, { id: client.id });
  writeDB(db);
  res.json(client);
});

app.delete("/api/clients/:id", (req, res) => {
  let db = readDB();
  db.clients = db.clients.filter(c => c.id != req.params.id);
  db.transactions = db.transactions.filter(t => t.clientId != req.params.id);
  db.reminders = db.reminders.filter(r => r.clientId != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.get("/api/transactions", (req, res) => {
  res.json(readDB().transactions);
});

app.post("/api/transactions", (req, res) => {
  const db = readDB();
  const t = {
    id: nextId(db.transactions),
    clientId: Number(req.body.clientId) || null,
    type: req.body.type || "vente",
    cardName: req.body.cardName || "",
    cardNumber: req.body.cardNumber || "",
    cardImage: req.body.cardImage || "",
    setLogo: req.body.setLogo || "",
    amount: Number(req.body.amount) || 0,
    cost: Number(req.body.cost) || 0,
    status: req.body.status || "termine",
    notes: req.body.notes || "",
    date: req.body.date || new Date().toISOString().slice(0, 10)
  };
  t.profit = t.type === "achat" ? 0 : t.amount - t.cost;
  db.transactions.push(t);
  writeDB(db);
  res.status(201).json(t);
});

app.put("/api/transactions/:id", (req, res) => {
  const db = readDB();
  const t = db.transactions.find(x => x.id == req.params.id);
  if (!t) return res.status(404).json({ error: "Transaction introuvable" });
  Object.assign(t, req.body, { id: t.id });
  t.amount = Number(t.amount) || 0;
  t.cost = Number(t.cost) || 0;
  t.profit = t.type === "achat" ? 0 : t.amount - t.cost;
  writeDB(db);
  res.json(t);
});

app.delete("/api/transactions/:id", (req, res) => {
  const db = readDB();
  db.transactions = db.transactions.filter(t => t.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.get("/api/reminders", (req, res) => {
  const db = readDB();
  const reminders = [...db.reminders].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  res.json(reminders);
});

app.post("/api/reminders", (req, res) => {
  const db = readDB();
  const r = {
    id: nextId(db.reminders),
    clientId: Number(req.body.clientId) || null,
    title: req.body.title || "Relance client",
    date: req.body.date || new Date().toISOString().slice(0, 10),
    done: false,
    notes: req.body.notes || ""
  };
  db.reminders.push(r);
  writeDB(db);
  res.status(201).json(r);
});

app.put("/api/reminders/:id", (req, res) => {
  const db = readDB();
  const r = db.reminders.find(x => x.id == req.params.id);
  if (!r) return res.status(404).json({ error: "Rappel introuvable" });
  Object.assign(r, req.body, { id: r.id });
  writeDB(db);
  res.json(r);
});

app.delete("/api/reminders/:id", (req, res) => {
  const db = readDB();
  db.reminders = db.reminders.filter(r => r.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const now = new Date();
  const month = now.toISOString().slice(0, 7);

  const sales = db.transactions.filter(t => t.type === "vente");
  const purchases = db.transactions.filter(t => t.type === "achat");
  const trades = db.transactions.filter(t => t.type === "trade");

  const monthlySales = sales.filter(t => (t.date || "").startsWith(month));
  const revenue = sales.reduce((s, t) => s + (t.amount || 0), 0);
  const monthlyRevenue = monthlySales.reduce((s, t) => s + (t.amount || 0), 0);
  const profit = sales.reduce((s, t) => s + (t.profit || 0), 0);

  const byCard = {};
  sales.forEach(t => {
    const key = t.cardName || "Carte inconnue";
    byCard[key] = (byCard[key] || 0) + (t.amount || 0);
  });

  const topCards = Object.entries(byCard)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  res.json({
    clients: db.clients.length,
    prospects: db.clients.filter(c => c.status === "prospect").length,
    activeClients: db.clients.filter(c => c.status === "actif").length,
    sales: sales.length,
    purchases: purchases.length,
    trades: trades.length,
    revenue,
    monthlyRevenue,
    profit,
    topCards
  });
});

app.get("/api/titre", async (req, res) => {
  const nom = (req.query.nom || "").trim();
  const num = (req.query.num || "").trim();
  if (!nom) return res.status(400).json({ erreur: "Nom manquant." });

  try {
    let local = null, total = null;
    const m = num.match(/^(\w+)(?:\s*\/\s*(\d+))?$/);
    if (m) {
      local = m[1];
      total = m[2] ? parseInt(m[2], 10) : null;
    }

    let liste = await get(`${API}/cards?name=${encodeURIComponent(nom)}`);
    if (!Array.isArray(liste)) liste = [];

    if (local) {
      const n = /^\d+$/.test(local) ? parseInt(local, 10) : null;
      liste = liste.filter(c => {
        const id = String(c.localId || "");
        return n !== null
          ? /^\d+$/.test(id) && parseInt(id, 10) === n
          : id.toLowerCase() === local.toLowerCase();
      });
    }

    liste = liste.slice(0, 12);
    const details = await Promise.all(
      liste.map(c => get(`${API}/cards/${encodeURIComponent(c.id)}`).catch(() => null))
    );

    let resultats = details.filter(Boolean).map(d => {
      const off = d.set && d.set.cardCount ? d.set.cardCount.official : null;
      const numero = off ? `${pad(d.localId, off)}/${off}` : String(d.localId);
      return {
        id: d.id,
        name: d.name,
        numero,
        official: off,
        image: d.image ? d.image + "/high.webp" : null,
        serie: d.set && d.set.name ? d.set.name : "",
        serieLogo: d.set && d.set.logo ? d.set.logo + ".webp" : null,
        serieSymbol: d.set && d.set.symbol ? d.set.symbol + ".webp" : null,
        titre: `Carte Pokémon ${d.name} ${numero}${d.set && d.set.name ? " – " + d.set.name : ""}`
      };
    });

    if (total) {
      const exact = resultats.filter(r => r.official === total);
      if (exact.length) resultats = exact;
    }

    res.json({ resultats });
  } catch (e) {
    res.status(502).json({ resultats: [], erreur: "Recherche TCGdex indisponible." });
  }
});

app.get("/logos.json", (req, res) => {
  res.sendFile(path.join(__dirname, "logos.json"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mickey Kingdom CRM prêt sur le port ${PORT}`));

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_FILE || "contracts.db");

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  contract_date TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  second_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  first_signature TEXT,
  second_signature TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_token ON contracts(owner_token);
CREATE INDEX IF NOT EXISTS idx_share_token ON contracts(share_token);
`);

app.use(express.json({limit: "2mb"}));
app.use(express.static(path.join(__dirname, "public")));

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const token = () => crypto.randomBytes(32).toString("hex");

function contractView(row) {
  return {
    id: row.id,
    title: row.title,
    contractDate: row.contract_date,
    firstName: row.first_name,
    secondName: row.second_name,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareUrl: `/sign/${row.share_token}`,
    firstSignature: row.first_signature ? JSON.parse(row.first_signature) : null,
    secondSignature: row.second_signature ? JSON.parse(row.second_signature) : null
  };
}

function getById(contractId) {
  return db.prepare("SELECT * FROM contracts WHERE id = ?").get(contractId);
}

function getByShare(shareToken) {
  return db.prepare("SELECT * FROM contracts WHERE share_token = ?").get(shareToken);
}

app.post("/api/contracts", (req, res) => {
  const ownerToken = req.body.ownerToken || token();
  const createdAt = now();
  const contractId = id();
  const shareToken = token();

  db.prepare(`
    INSERT INTO contracts
    (id, owner_token, share_token, title, contract_date, first_name, second_name, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    contractId,
    ownerToken,
    shareToken,
    String(req.body.title || ""),
    String(req.body.contractDate || ""),
    String(req.body.firstName || ""),
    String(req.body.secondName || ""),
    String(req.body.content || ""),
    createdAt,
    createdAt
  );

  res.json({ ownerToken, contract: contractView(getById(contractId)) });
});

app.get("/api/contracts", (req, res) => {
  const ownerToken = String(req.query.ownerToken || "");
  if (!ownerToken) return res.json([]);
  const rows = db.prepare("SELECT * FROM contracts WHERE owner_token = ? ORDER BY updated_at DESC").all(ownerToken);
  res.json(rows.map(contractView));
});

app.get("/api/contracts/:id", (req, res) => {
  const row = getById(req.params.id);
  if (!row) return res.status(404).json({error: "Contract not found"});
  if (row.owner_token !== String(req.query.ownerToken || "")) {
    return res.status(403).json({error: "Owner access required"});
  }
  res.json(contractView(row));
});

app.put("/api/contracts/:id", (req, res) => {
  const row = getById(req.params.id);
  if (!row) return res.status(404).json({error: "Contract not found"});
  if (row.owner_token !== String(req.body.ownerToken || "")) {
    return res.status(403).json({error: "Owner access required"});
  }
  if (row.status !== "draft") {
    return res.status(409).json({error: "The contract is locked after the first signature."});
  }

  db.prepare(`
    UPDATE contracts
    SET title = ?, contract_date = ?, first_name = ?, second_name = ?, content = ?, updated_at = ?
    WHERE id = ?
  `).run(
    String(req.body.title || ""),
    String(req.body.contractDate || ""),
    String(req.body.firstName || ""),
    String(req.body.secondName || ""),
    String(req.body.content || ""),
    now(),
    row.id
  );

  res.json(contractView(getById(row.id)));
});

app.post("/api/contracts/:id/send", (req, res) => {
  const row = getById(req.params.id);
  if (!row) return res.status(404).json({error: "Contract not found"});
  if (row.owner_token !== String(req.body.ownerToken || "")) {
    return res.status(403).json({error: "Owner access required"});
  }
  if (row.status !== "draft") {
    return res.status(409).json({error: "Contract has already been sent."});
  }
  if (!row.title.trim() || !row.first_name.trim() || !row.second_name.trim() || !row.content.trim()) {
    return res.status(400).json({error: "Add a title, both names, and contract terms before sending."});
  }

  db.prepare("UPDATE contracts SET status = 'waiting', updated_at = ? WHERE id = ?")
    .run(now(), row.id);

  res.json(contractView(getById(row.id)));
});

app.get("/api/sign/:shareToken", (req, res) => {
  const row = getByShare(req.params.shareToken);
  if (!row) return res.status(404).json({error: "Private contract link not found."});
  res.json(contractView(row));
});

app.post("/api/sign/:shareToken", (req, res) => {
  const row = getByShare(req.params.shareToken);
  if (!row) return res.status(404).json({error: "Private contract link not found."});
  if (row.status === "draft") return res.status(409).json({error: "The owner has not sent this contract for signature yet."});
  if (row.status === "fully_signed") return res.status(409).json({error: "This contract is already fully signed."});

  const signer = String(req.body.signer || "");
  const signerName = String(req.body.name || "").trim();
  const signature = String(req.body.signature || "").trim();
  if (signer !== "first" && signer !== "second") return res.status(400).json({error: "Invalid signer."});
  if (!signerName || !signature) return res.status(400).json({error: "Name and signature are required."});

  const signed = { name: signerName, signature, signedAt: now() };

  if (row.status !== "draft" && signer === "first" && !row.first_signature) {
    db.prepare("UPDATE contracts SET first_signature = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(signed), row.second_signature ? "fully_signed" : "partially_signed", now(), row.id);
  } else if (signer === "second" && !row.second_signature) {
    db.prepare("UPDATE contracts SET second_signature = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(signed), row.first_signature ? "fully_signed" : "partially_signed", now(), row.id);
  } else {
    return res.status(409).json({error: "That signature has already been recorded."});
  }

  res.json(contractView(getById(row.id)));
});

app.get("/sign/:shareToken", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sign.html"));
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Digital Contract Platform running at http://localhost:${PORT}`);
});
// server.js
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("🚀 Cardinal Calculator backend running on port " + PORT);
});

app.post("/inference", (req, res) => {
  // Generate random demo values
  const price = Math.floor(Math.random() * 250) + 50;     // $50–$300
  const risk = Math.floor(Math.random() * 100);           // 0–100%
  const upsell = Math.floor(Math.random() * 100);         // 0–100%

  res.json({ price, risk, upsell });
});
// ====== EMAIL STORAGE ROUTES ======
import fs from "fs";
import path from "path";

const EMAIL_FILE = path.join(process.cwd(), "emails.json");

app.post("/email", (req, res) => {
  const { email, role } = req.body;
  const entry = { email, role, time: new Date().toISOString() };

  let data = [];
  if (fs.existsSync(EMAIL_FILE)) {
    data = JSON.parse(fs.readFileSync(EMAIL_FILE));
  }
  data.push(entry);
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(data, null, 2));

  res.json({ success: true, message: "Saved to local store." });
});

app.get("/emails", (req, res) => {
  if (!fs.existsSync(EMAIL_FILE)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(EMAIL_FILE));
  res.json(data);
});
// ====== EMAIL STORAGE ROUTES ======
import fs from "fs";
import path from "path";

const EMAIL_FILE = path.join(process.cwd(), "emails.json");

app.post("/email", (req, res) => {
  const { email, role } = req.body;
  const entry = { email, role, time: new Date().toISOString() };

  let data = [];
  if (fs.existsSync(EMAIL_FILE)) {
    data = JSON.parse(fs.readFileSync(EMAIL_FILE));
  }
  data.push(entry);
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(data, null, 2));

  res.json({ success: true, message: "Saved to local store." });
});

app.get("/emails", (req, res) => {
  if (!fs.existsSync(EMAIL_FILE)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(EMAIL_FILE));
  res.json(data);
});

app.post("/email", (req, res) => {
  const { email, role } = req.body;
  console.log("📩 New signup:", email, "as", role);
  res.json({ success: true, message: "Email received." });
});

app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator backend running on port ${PORT}`);
});

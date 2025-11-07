// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("🚀 Cardinal Calculator backend running on port " + PORT);
});

// ====== INFERENCE (DEMO DATA) ======
app.post("/inference", (req, res) => {
  // Generate random demo values
  const price = Math.floor(Math.random() * 250) + 50; // $50–$300
  const risk = Math.floor(Math.random() * 100);       // 0–100%
  const upsell = Math.floor(Math.random() * 100);     // 0–100%

  res.json({ price, risk, upsell });
});

// ====== EMAIL STORAGE ======
const EMAIL_FILE = path.join(process.cwd(), "emails.json");

app.post("/email", (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ success: false, message: "Missing email or role." });
  }

  const entry = { email, role, time: new Date().toISOString() };

  let data = [];
  if (fs.existsSync(EMAIL_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf8"));
    } catch (err) {
      console.error("Failed to read existing emails.json:", err);
    }
  }

  data.push(entry);
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(data, null, 2));

  console.log("📩 New signup:", email, "as", role);
  res.json({ success: true, message: "Email saved locally." });
});

app.get("/emails", (req, res) => {
  if (!fs.existsSync(EMAIL_FILE)) return res.json([]);
  try {
    const data = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to read emails.json." });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator backend running on port ${PORT}`);
});

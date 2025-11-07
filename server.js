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

app.post("/email", (req, res) => {
  const { email, role } = req.body;
  console.log("📩 New signup:", email, "as", role);
  res.json({ success: true, message: "Email received." });
});

app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator backend running on port ${PORT}`);
});

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

// ====== MOCK INFERENCE ROUTE ======
app.post("/inference", (req, res) => {
  // Pretend we analyzed an image and return test data
  res.json({
    price: 75,
    risk: 40,
    upsell: 60
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator backend running on port ${PORT}`);
});

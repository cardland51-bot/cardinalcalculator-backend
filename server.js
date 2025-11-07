// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ====== OPENAI CONFIG ======
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({ dest: "uploads/" });

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("🚀 Cardinal Calculator AI backend running on port " + PORT);
});

// ====== EMAIL SIGNUP ======
app.post("/email", (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: "Missing email" });
  console.log(`📩 New signup: ${email} (${role || "unknown"})`);
  res.json({ ok: true });
});

// ====== ANALYZE IMAGE (AI Vision) ======
app.post("/analyze-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const imagePath = req.file.path;

    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Jared, a friendly but sharp landscape estimator.
          Analyze yard photos for condition, scope, and opportunity.
          Return concise insights for a quote.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this photo for yard condition and project potential." },
            { type: "image_url", image_url: `file://${imagePath}` },
          ],
        },
      ],
    });

    const summary = result.choices[0].message.content.trim();

    // ===== Simple heuristic scoring =====
    const t = summary.toLowerCase();
    let close = 60,
        upsell = 45,
        risk = 30;

    if (/clean|defined|fresh|crisp|edg(e|ing)/.test(t)) close += 20;
    if (/bare|patchy|overgrown|erosion|water|drain/.test(t)) risk += 25;
    if (/mulch|stone|border|trim|reshape|design/.test(t)) upsell += 25;
    close = Math.max(5, Math.min(98, close));
    upsell = Math.max(5, Math.min(98, upsell));
    risk = Math.max(3, Math.min(95, risk));

    fs.unlinkSync(imagePath); // clean up temp file

    res.json({
      summary,
      closePct: close,
      upsellPct: upsell,
      riskPct: risk,
    });
  } catch (err) {
    console.error("❌ /analyze-image error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ====== INFERENCE (AI Text Logic) ======
app.post("/inference", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });

    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Jared, a confident but calm landscape estimator.
          Respond briefly and conversationally like a field rep.
          Focus on pricing logic, yard insights, and service upsells.`,
        },
        { role: "user", content: text },
      ],
    });

    const content = result.choices[0].message.content.trim();
    res.json({ content });
  } catch (err) {
    console.error("❌ /inference error:", err);
    res.status(500).json({ error: "Inference failed" });
  }
});

// ====== SPEAK (Text-to-Speech) ======
app.post("/speak", async (req, res) => {
  try {
    const { text, voice = "alloy" } = req.body;
    if (!text) return res.status(400).send("Missing text");

    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
    });

    res.setHeader("Content-Type", "audio/mpeg");
    speech.body.pipe(res);
  } catch (err) {
    console.error("❌ /speak error:", err);
    res.status(500).send("Speech synthesis failed");
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator AI backend running on port ${PORT}`);
});

// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json());

// ====== OPENAI CLIENT ======
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// for image uploads
const upload = multer({ dest: "uploads/" });

// ====== ROOT TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("🚀 Cardinal Calculator AI backend running on port " + PORT);
});

// ====== EMAIL SIGNUP (LIGHTWEIGHT) ======
// Allows people to pass through; just logs if provided.
app.post("/email", (req, res) => {
  const { email, role } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, message: "Missing email" });
  }
  console.log(`📩 New signup: ${email} (${role || "unknown"})`);
  res.json({ ok: true });
});

// ====== ANALYZE IMAGE (VISION → SUMMARY + METRICS) ======
app.post("/analyze-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imagePath = req.file.path;

    // Read file and send as base64 data URL to OpenAI
    const base64 = fs.readFileSync(imagePath, { encoding: "base64" });
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Jared, a sharp but honest landscape estimator. Analyze yard photos in clean, practical language for scope, condition, and opportunities.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Look at this yard photo. Describe condition, risk flags, and upsell opportunities in 2–4 short sentences.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    });

    // Clean up temp file
    fs.unlinkSync(imagePath);

    const summary = (response.choices?.[0]?.message?.content || "").trim() || 
      "Analysis complete. Standard prep and edging recommended.";

    // Simple heuristic scores based on summary text
    const t = summary.toLowerCase();
    let close = 60;
    let upsell = 45;
    let risk = 30;

    if (/clean|defined|fresh|crisp|edge|edging|tight/.test(t)) {
      close += 15;
    }
    if (/overgrown|bare|patchy|erosion|washout|standing water|drain/.test(t)) {
      risk += 25;
      close -= 10;
    }
    if (/mulch|stone|border|trim|reshape|bed|plant|upgrade|lighting/.test(t)) {
      upsell += 25;
    }

    // clamp
    close = Math.max(5, Math.min(98, close));
    upsell = Math.max(5, Math.min(98, upsell));
    risk = Math.max(3, Math.min(95, risk));

    return res.json({
      summary,
      closePct: close,
      upsellPct: upsell,
      riskPct: risk,
    });
  } catch (err) {
    console.error("❌ /analyze-image error:", err);
    return res.status(500).json({ error: "Analysis failed" });
  }
});

// ====== INFERENCE (TEXT → SHORT ANSWER) ======
app.post("/inference", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Jared, a field estimator. Be brief, specific, and practical. Help with pricing logic, scope clarity, and next steps.",
        },
        { role: "user", content: text },
      ],
    });

    const content = (response.choices?.[0]?.message?.content || "").trim();
    return res.json({ content });
  } catch (err) {
    console.error("❌ /inference error:", err);
    return res.status(500).json({ error: "Inference failed" });
  }
});

// ====== SPEAK (TEXT → AUDIO) ======
app.post("/speak", async (req, res) => {
  try {
    const { text, voice = "alloy" } = req.body || {};
    if (!text) {
      return res.status(400).send("Missing text");
    }

    const mp3 = await client.audio.speech.create({
      model: "gpt-4o-mini-tts", // or "tts-1" / "tts-1-hd"
      voice,
      input: text,
    }); // :contentReference[oaicite:0]{index=0}

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("❌ /speak error:", err);
    res.status(500).send("Speech synthesis failed");
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator AI backend running on port ${PORT}`);
});

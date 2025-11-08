// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// ========= HELPERS =========
function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// ========= ADMIN CONFIG (LIVE TUNING) =========
let ADMIN_CONFIG = {
  model: "gpt-4o-mini",       // Jared's brain
  priceMultiplier: 1.15,      // global price bias
  weights: {
    risk: 40,
    upsell: 55
  },
  flags: {
    vision: true,
    tts: true,
    strict: false,
    logging: false,
    autoTune: false
  }
};

// ========= OPENAI CLIENT =========
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ========= MIDDLEWARE =========
app.use(cors());             // open for now; tighten later per domain
app.use(express.json());

// file upload temp dir
const upload = multer({ dest: "uploads/" });

// ========= ROOT TEST =========
app.get("/", (req, res) => {
  res.send("🚀 Cardinal Calculator AI backend running on port " + PORT);
});

// ========= EMAIL SIGNUP =========
// Lightweight gate / pass-through: used by landing + homeowner flows
app.post("/email", (req, res) => {
  try {
    const { email, role, area, mode } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email" });
    }

    if (ADMIN_CONFIG.flags.logging) {
      console.log("📩 Signup", { email, role, area, mode });
    } else {
      console.log(`📩 New signup: ${email} (${role || "unknown"})`);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ /email error:", err);
    return res.status(500).json({ ok: false, error: "Email capture failed" });
  }
});

// ========= ANALYZE IMAGE (HERO: ONE SWITCH) =========
// Used by BOTH:
// - Homeowner Lawn Check (friendly read, no pricing)
// - Pro / Yard Intelligence (feeds price + intel)
// Frontend decides how to use result.
app.post("/analyze-image", upload.single("file"), async (req, res) => {
  let imagePath;
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    imagePath = req.file.path;

    const base64 = fs.readFileSync(imagePath, { encoding: "base64" });
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const systemPrompt =
      "You are Jared, a sharp but honest field estimator. " +
      "Given a yard / exterior / work-zone photo, describe condition, risk, and opportunities " +
      "in 2–4 short sentences. No fear talk. No product brands.";

    const userPrompt =
      "Look at this photo. In 2–4 short sentences, describe:\n" +
      "- overall condition\n" +
      "- obvious risk flags (slope, clutter, edges, water)\n" +
      "- simple upsell or tune-up opportunities.";

    const completion = await client.chat.completions.create({
      model: ADMIN_CONFIG.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    });

    const summary =
      (completion.choices?.[0]?.message?.content || "").trim() ||
      "Analysis complete. Standard prep and edging recommended.";

    const t = summary.toLowerCase();

    let close = 60;
    let upsell = 45;
    let risk = 30;

    // Very simple text-based heuristics (safe, tunable)
    if (/clean|defined|fresh|crisp|edge|edging|tight|tidy/.test(t)) {
      close += 15;
    }
    if (/overgrown|bare|patchy|erosion|washout|standing water|puddle|drain/.test(t)) {
      risk += 25;
      close -= 10;
    }
    if (/mulch|stone|border|trim|reshape|bed|plant|upgrade|lighting|seal|coat/.test(t)) {
      upsell += 25;
    }

    close = clamp(close, 5, 98);
    upsell = clamp(upsell, 5, 98);
    risk = clamp(risk, 3, 95);

    const payload = {
      ok: true,
      summary,
      closePct: close,
      upsellPct: upsell,
      riskPct: risk
      // if you want: attach light hints later:
      // mode: req.body.mode, source: req.body.source
    };

    if (ADMIN_CONFIG.flags.logging) {
      console.log("📷 /analyze-image →", payload);
    }

    return res.json(payload);
  } catch (err) {
    console.error("❌ /analyze-image error:", err);
    return res.status(500).json({ ok: false, error: "Analysis failed" });
  } finally {
    if (imagePath) {
      fs.unlink(imagePath, () => {});
    }
  }
});

// ========= INFERENCE (TEXT-ONLY, NO FILES) =========
// Use for: "Jared, given this text blob, help me decide X."
app.post("/inference", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const prompt = text.slice(0, 2000);

    const completion = await client.chat.completions.create({
      model: ADMIN_CONFIG.model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Jared, a field estimator. Be concise, concrete, and practical. " +
            "No fluff. One small decision at a time."
        },
        { role: "user", content: prompt }
      ]
    });

    const content = (completion.choices?.[0]?.message?.content || "").trim();

    return res.json({ ok: true, content });
  } catch (err) {
    console.error("❌ /inference error:", err);
    return res.status(500).json({ ok: false, error: "Inference failed" });
  }
});

// ========= SPEAK (TEXT → AUDIO) =========
// Optional helper; frontends can ignore if not using.
app.post("/speak", async (req, res) => {
  try {
    const { text, voice = "alloy" } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).send("Missing text");
    }

    const mp3 = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",  // adjust to your available TTS model
      voice,
      input: text.slice(0, 1000)
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("❌ /speak error:", err);
    res.status(500).send("Speech synthesis failed");
  }
});

// ========= PRICE ENGINE =========
// Pro lane: called AFTER /analyze-image using its metrics.
app.post("/price", (req, res) => {
  try {
    const {
      sqft = 0,
      baseType = "mulch",     // mulch | cleanup | edging | premium
      complexity = "normal",  // easy | normal | complex
      riskLevel,
      upsellScore
    } = req.body || {};

    const sq = Number(sqft) || 0;

    const BASE_RATES = {
      mulch: 0.18,
      cleanup: 0.22,
      edging: 0.25,
      premium: 0.30
    };

    let baseRate = BASE_RATES[baseType] || BASE_RATES.mulch;

    let complexityMult = 1.0;
    if (complexity === "easy") complexityMult = 0.9;
    if (complexity === "complex") complexityMult = 1.25;

    const risk = clamp(
      typeof riskLevel === "number" ? riskLevel : ADMIN_CONFIG.weights.risk,
      0,
      100
    );
    const upsell = clamp(
      typeof upsellScore === "number" ? upsellScore : ADMIN_CONFIG.weights.upsell,
      0,
      100
    );

    const riskMult = 1 + (risk / 100) * 0.18;     // up to +18%
    const upsellAdd = (upsell / 100) * 75;        // suggestion buffer
    const adminMult = ADMIN_CONFIG.priceMultiplier || 1.0;

    const materialAndLabor = sq * baseRate * complexityMult;
    const corePrice = materialAndLabor * riskMult * adminMult;

    const roundedCore = Math.round(corePrice / 5) * 5;
    const suggestedHigh = Math.round((roundedCore + upsellAdd) / 5) * 5;
    const suggestedLow = Math.max(0, Math.round(roundedCore * 0.92 / 5) * 5);

    const payload = {
      ok: true,
      sqft: sq,
      baseType,
      complexity,
      corePrice: roundedCore,
      range: {
        low: suggestedLow,
        target: roundedCore,
        withUpsell: suggestedHigh
      },
      configUsed: {
        model: ADMIN_CONFIG.model,
        priceMultiplier: ADMIN_CONFIG.priceMultiplier,
        weights: ADMIN_CONFIG.weights
      },
      notes: [
        `Base rate: $${baseRate.toFixed(2)}/sqft`,
        `Complexity x${complexityMult.toFixed(2)}, Risk x${riskMult.toFixed(2)}, Admin x${adminMult.toFixed(2)}`,
        `Upsell signal: ${upsell}/100 → +$${Math.round(upsellAdd)} potential add-ons`
      ]
    };

    if (ADMIN_CONFIG.flags.logging) {
      console.log("💵 /price:", payload);
    }

    return res.json(payload);
  } catch (err) {
    console.error("❌ /price error:", err);
    return res.status(500).json({ ok: false, error: "Price calc failed" });
  }
});

// ========= PRO: JOB INTEL / PLAYBOOK =========
// Gated: Pro / SU / Founder tiers hit this, not free.
app.post("/pro/job-intel", async (req, res) => {
  try {
    const {
      summary,
      closePct,
      riskPct,
      upsellPct
    } = req.body || {};

    if (!summary) {
      return res.status(400).json({ ok: false, error: "Missing summary" });
    }

    const tier = req.headers["x-cardinal-tier"] || "free";
    if (tier === "free") {
      return res.status(403).json({
        ok: false,
        error: "Upgrade required for job intel."
      });
    }

    const prompt = `
Given:
- Summary: """${summary}"""
- Close: ${closePct ?? "n/a"}
- Risk: ${riskPct ?? "n/a"}
- Upsell: ${upsellPct ?? "n/a"}

Return a compact JSON object ONLY:
{
  "jobType": "...",
  "difficulty": "easy|standard|complex",
  "crewPlan": {
    "crewSize": 2,
    "hours": 4,
    "notes": "..."
  },
  "lineItems": [
    { "label": "...", "hint": "..." }
  ],
  "upsellIdeas": ["..."],
  "riskFlags": ["..."],
  "estimationNotes": "1–2 sentences."
}
`.trim();

    const completion = await client.chat.completions.create({
      model: ADMIN_CONFIG.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You output STRICT JSON. No markdown, no commentary." },
        { role: "user", content: prompt }
      ]
    });

    const raw = (completion.choices?.[0]?.message?.content || "").trim();

    let intel;
    try {
      intel = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse fail on /pro/job-intel:", raw);
      return res.status(500).json({ ok: false, error: "Bad AI format" });
    }

    const payload = {
      ok: true,
      tier,
      intel,
      configUsed: {
        model: ADMIN_CONFIG.model,
        weights: ADMIN_CONFIG.weights
      }
    };

    if (ADMIN_CONFIG.flags.logging) {
      console.log("🧠 /pro/job-intel:", payload);
    }

    return res.json(payload);
  } catch (err) {
    console.error("❌ /pro/job-intel error:", err);
    return res.status(500).json({ ok: false, error: "Job intel failed" });
  }
});

// ========= START =========
app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator AI backend running on port ${PORT}`);
});


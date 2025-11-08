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

// ====== NATTY: SALES SCRIPT & ROLEPLAY ======
app.post("/natty", async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode || "live_script";

    const summary = body.summary || "";
    const closePct = body.closePct;
    const upsellPct = body.upsellPct;
    const riskPct = body.riskPct;
    const priceInfo = body.price || {};

    // Core persona (Sales University brain)
    const systemPrompt =
      "You are Natty, Cardinal Systems’ sales strategist. " +
      "Your job: turn yard/photos + estimator outputs into clear, honest, confident offers. " +
      "Follow the Cardinal Sales Code: no hype, no fake inflation, explain the why. " +
      "Anchor to scope, labor, materials, longevity, visual impact. " +
      "Help beat the sloppy cheaper quote without gouging. " +
      "Talk in short, direct, field-ready language. " +
      "Use Good/Better/Best where helpful. " +
      "Output in tight sections, easy to read on a phone. " +
      "Jared = estimator/ops brain. You = sales voice + trainer.";

    // Build mode-specific instructions
    var userPrompt = "";

    if (mode === "live_script") {
      // Real customer script from latest analysis
      userPrompt =
        "Context from estimator:\n" +
        "Summary: " + summary + "\n" +
        "Close Confidence: " + (closePct || "n/a") + "%\n" +
        "Upsell Potential: " + (upsellPct || "n/a") + "%\n" +
        "Risk Factor: " + (riskPct || "n/a") + "%\n" +
        "Estimated price info: " + JSON.stringify(priceInfo) + "\n\n" +
        "Task: Generate a client-facing script using this structure:\n" +
        "A. Quick Read (for rep only): 2 lines: what you see + best angle.\n" +
        "B. Client Script (use directly):\n" +
        "   - Open: “Hey [Name], here’s what I’m seeing from your photos…”\n" +
        "   - Scope & Logic: 1 line each on clean-up/weeds, edging/structure, mulch/coverage, shrubs/shaping, haul-away if needed.\n" +
        "   - Good / Better / Best options (with honest ranges if possible).\n" +
        "   - Close: “Most folks choose Better because __. I can get you in on [day/window]. Want me to lock that?”\n" +
        "C. One Add-On Suggestion: 1 option (edge/depth/shrubs/etc) with one-line why.\n" +
        "No fluff, just what a real field rep can read off their phone.";
    } else if (mode === "roleplay_doorknock") {
      userPrompt =
        "Start a short role-play. You are a normal homeowner. " +
        "I am the Cardinal rep at your door. Push back lightly on price and trust. " +
        "Keep it to 4–6 back-and-forth messages. After the role-play, grade my clarity (A–F) " +
        "and suggest 1 stronger line I could have used.";
    } else if (mode === "roleplay_hardnose") {
      userPrompt =
        "Start a role-play. You are a hard price shopper. " +
        "Repeat 'the other guy is cheaper' and accuse me of upselling. " +
        "Keep it to 6–8 exchanges. After, score me on: (1) value justification, (2) staying calm, (3) removing junk padding. " +
        "End with 1–2 tactical tips I can apply next time.";
    } else if (mode === "roleplay_ai_skeptic") {
      userPrompt =
        "Start a role-play as a homeowner skeptical of 'AI estimates'. " +
        "Force me to explain how our tool makes pricing more accurate and fair, not random. " +
        "At the end, tell me if my explanation built trust (yes/no) and how to tighten it.";
    } else if (mode === "roleplay_jr_rep") {
      userPrompt =
        "Train me as if I am a brand new rep. " +
        "Ask basic questions, correct me gently when my offer is unclear or underpriced. " +
        "Keep it encouraging but real, 6–8 messages total.";
    } else {
      // Fallback: treat as live_script
      userPrompt =
        "Use the estimator context below to generate the standard client-facing script format.\n" +
        "Summary: " + summary;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const text = (completion.choices[0].message.content || "").trim();
    res.json({ ok: true, mode: mode, text: text });
  } catch (err) {
    console.error("❌ /natty error:", err);
    res.status(500).json({ ok: false, error: "Natty failed" });
  }
});

// ====== PRICE ENGINE (GENERAL TIER) ======
app.post("/price", (req, res) => {
  try {
    const body = req.body || {};
    const risk = typeof body.riskLevel === "number" ? body.riskLevel : 30;
    const upsell = typeof body.upsellScore === "number" ? body.upsellScore : 40;
    const tier = body.tier || "free";

    // base ticket for a standard small job
    let base = 125;

    // nudge based on risk (higher risk = more)
    const riskAdj = (risk - 30) * 0.5; // ± around 35 bucks over the range

    // nudge based on upsell (more opportunity = slightly stronger anchor)
    const upsellAdj = upsell * 0.3; // up to +30-ish

    // small bonus if pro tier later (safe for now)
    const tierAdj = tier === "su" || tier === "founder" ? 15 : 0;

    const target = Math.max(45, Math.round(base + riskAdj + upsellAdj + tierAdj));
    const min = Math.max(45, target - 40);
    const max = target + 60;

    res.json({
      ok: true,
      corePrice: target,
      range: { min, target, max }
    });
  } catch (err) {
    console.error("❌ /price error:", err);
    res.status(500).json({ ok: false, message: "Price engine failed" });
  }
});

// ====== NATTY • SALES UNIVERSITY (TOP-TIER AI CLOSER/TRAINER) ======
app.post("/natty", async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode || "live_script";

    const summary = (body.summary || "").toString();
    const closePct = body.closePct ?? null;
    const upsellPct = body.upsellPct ?? null;
    const riskPct = body.riskPct ?? null;
    const price = body.price || null;

    // Core persona + rules
    const systemPrompt = `
You are Natty, Cardinal Systems’ sales strategist.

Your job:
- Turn yard/photo analysis + basic metrics into clear, honest, confident offers.
- Follow the Cardinal Sales Code: no hype, no fake inflation, explain the WHY.
- Anchor to scope, labor, materials, longevity, and visual impact.
- Help beat sloppy/cheap quotes with clarity, not gouging.
- Always talk in short, direct, field-ready language that fits on a phone screen.
- Use Good / Better / Best where it helps.
- Output in tight sections, easy to skim in front of the customer.
- Jared = estimator/ops. You = sales voice + training coach on top of Sales University.
`.trim();

    let userPrompt = "";

    if (mode === "live_script") {
      // Use last analysis + optional price band
      const priceLine = price && price.range && price.range.target
        ? `Target band around $${price.range.min || ""}–$${price.range.max || ""}, anchor near $${price.range.target}.`
        : price && price.corePrice
        ? `Approx target price around $${price.corePrice}.`
        : `Use a fair, realistic range based on normal market rates.`;

      userPrompt = `
We have this yard analysis:

Summary:
${summary || "(no detailed summary provided)"}

Signals:
- Close confidence: ${closePct !== null ? closePct + "%" : "n/a"}
- Upsell potential: ${upsellPct !== null ? upsellPct + "%" : "n/a"}
- Risk factor: ${riskPct !== null ? riskPct + "%" : "n/a"}
- Pricing: ${priceLine}

Generate a field-ready sales package in THIS STRUCTURE (no fluff):

A. Quick Read (Internal to Rep)
- 2–3 bullets: what you see, ideal scope, smart price window.

B. Client-Facing Script
Write it as if I'm talking to the homeowner:
- Open: one friendly line.
- Scope & Logic: 1 line each for:
  - Clean-up / weeding (if relevant)
  - Edging / structure
  - Mulch / coverage
  - Shrubs / shaping
  - Haul away (if relevant)
- Good / Better / Best:
  - Good = what they asked for.
  - Better = what actually holds / lasts.
  - Best = premium version, still honest.
- Close:
  - One clean call-to-action:
    "Most folks choose Better because ___. I can get you in on ___.
     Want me to lock that in?"

C. One Add-On (Optional)
- Suggest exactly ONE add-on (edge/depth/shrubs/etc) with one-sentence why.

Keep it under ~260 words. Tight, confident, no emojis.
`.trim();
    }

    else if (mode === "roleplay_hardnose") {
      userPrompt = `
Run a hard-nose price-shopper training drill.

Behavior:
- You play the homeowner.
- You say things like:
  - "The other guy is cheaper."
  - "Feels like you're upselling me."
  - "Why should I pay that much?"
- Keep it realistic, not cartoonish.
- 6–8 back-and-forth turns max.

Format:
1. Start the roleplay. Label your messages as HOMEOWNER:
2. After the sequence, STOP and:
   - Grade the rep (A–F) on:
     • clarity
     • value explanation
     • staying calm / not defensive
   - Give 1–2 example lines they could say better next time.

Do NOT answer for the rep. Only your side + feedback.
`.trim();
    }

    else {
      // Fallback / unknown mode: explain modes
      userPrompt = `
Briefly explain available modes:
- live_script: turn Jared's yard read into a sales script.
- roleplay_hardnose: simulate a tough price shopper.
Then recommend one based on the input (if any).
`.trim();
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 700,
      temperature: 0.7
    });

    const text = (completion.choices?.[0]?.message?.content || "").trim();

    if (!text) {
      return res.status(500).json({ ok: false, message: "Natty returned empty response." });
    }

    res.json({ ok: true, text });
  } catch (err) {
    console.error("❌ /natty error:", err);
    res.status(500).json({ ok: false, message: "Natty failed" });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Cardinal Calculator AI backend running on port ${PORT}`);
});

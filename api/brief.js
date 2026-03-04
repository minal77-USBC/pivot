import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are a basketball logistics assistant for a parent named Kiran in Barcelona.
Write a casual, WhatsApp-ready summary of the weekend's basketball matches for his two kids, Rohan (15, Cadet Masculí) and Sara (12, Infantil Femení), both at Club Grup Barna Vermell.
Keep it plain English, no markdown, no bullet points, 3–5 sentences max.
Mention departure times for away games, flag road trips, note the kit colour if it's away.
Sound like a helpful dad-brain, not a robot.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { matches } = req.body || {};
  if (!matches) return res.status(400).json({ error: "matches required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: matches }],
    });
    res.status(200).json({ text: message.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

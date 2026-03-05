export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ ok: false, reason: "Missing credential" });

  // Verify the Google ID token
  const tokenRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );
  const info = await tokenRes.json();

  if (info.error || !info.email) {
    return res.status(401).json({ ok: false, reason: "Invalid token" });
  }

  // Verify audience matches our client ID
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && info.aud !== clientId) {
    return res.status(401).json({ ok: false, reason: "Token audience mismatch" });
  }

  // Check email allowlist
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(info.email.toLowerCase())) {
    return res.status(403).json({ ok: false, reason: "Access restricted to family members." });
  }

  return res.json({
    ok: true,
    email: info.email,
    name: info.name || info.email,
    picture: info.picture || null,
    exp: Number(info.exp),
  });
}

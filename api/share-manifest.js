// Dynamic manifest for share link PWA installs.
// Sets start_url to /s/TOKEN so every home screen launch preserves the token.

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function handler(req, res) {
  const { token } = req.query;

  if (!token || !UUID_RE.test(token)) {
    return res.status(400).end();
  }

  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "no-store");
  res.json({
    name: "PIVOT · Basketball BCN",
    short_name: "PIVOT",
    start_url: `/?share_token=${token}`,
    display: "standalone",
    background_color: "#070912",
    theme_color: "#070912",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  });
}

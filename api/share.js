// Serves a minimal HTML page for /s/TOKEN share links.
// This page has its OWN manifest with start_url: /s/TOKEN so that when
// added to iOS home screen, the PWA always launches back to /s/TOKEN
// (not the main app's start_url: "/"), preserving the token forever.
// The page sets sessionStorage then redirects to / where the main app reads it.

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function handler(req, res) {
  const { token } = req.query;

  if (!token || !UUID_RE.test(token)) {
    return res.status(400).send("Invalid share link.");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="PIVOT" />
  <meta name="theme-color" content="#070912" />
  <link rel="manifest" href="/api/share-manifest?token=${token}" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <title>PIVOT</title>
  <style>body { margin: 0; background: #070912; }</style>
  <script>
    // Redirect to main app with token as URL param.
    // The manifest's start_url also uses this format so every PWA launch
    // carries the token in the URL — no storage dependency needed.
    localStorage.setItem('pivot_share_token', '${token}');
    location.replace('/?share_token=${token}');
  </script>
</head>
<body></body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
}

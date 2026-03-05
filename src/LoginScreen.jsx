import { useEffect, useRef, useState } from "react";

const CLIENT_ID = "110062790266-epf1sbr8in0vmcj6403p05e3hagpq215.apps.googleusercontent.com";

export default function LoginScreen({ onAuth }) {
  const btnRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            const data = await res.json();
            if (data.ok) {
              sessionStorage.setItem("pivot_auth", JSON.stringify(data));
              onAuth(data);
            } else {
              setError(data.reason || "Access denied.");
            }
          } catch {
            setError("Sign-in failed. Try again.");
          } finally {
            setLoading(false);
          }
        },
      });

      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 240,
        });
      }
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      const script = document.getElementById("gsi-script");
      if (script) script.addEventListener("load", init);
    }
  }, [onAuth]);

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      backgroundColor: "#070912",
      color: "#e2e8f0",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070912; }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontSize: 48, fontWeight: 800, letterSpacing: "0.05em",
          color: "#FF6B2B", lineHeight: 1,
        }}>PIVOT</div>
        <div style={{
          fontSize: 12, color: "#475569",
          letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 6,
        }}>Basketball · BCN</div>
      </div>

      <div style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "32px 28px",
        textAlign: "center",
        width: "100%",
        maxWidth: 320,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏀</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
          Family access only
        </div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24, lineHeight: 1.5 }}>
          Sign in with your Google account to continue.
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: "#475569", padding: "12px 0" }}>Signing in…</div>
        ) : (
          <div ref={btnRef} style={{ display: "flex", justifyContent: "center" }} />
        )}

        {error && (
          <div style={{
            marginTop: 14, fontSize: 13, color: "#ff4757",
            background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.25)",
            borderRadius: 8, padding: "8px 12px",
          }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#1e293b" }}>
        Rohan & Sara · 2025–26
      </div>
    </div>
  );
}

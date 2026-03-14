import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { useLang } from "./LangContext";
import { useTheme } from "./ThemeContext";

const CLIENT_ID = "110062790266-epf1sbr8in0vmcj6403p05e3hagpq215.apps.googleusercontent.com";

export default function LoginScreen({ onAuth }) {
  const { t } = useLang();
  const { theme } = useTheme();
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
              sessionStorage.setItem("pivot_credential", credential);
              track("user_signed_in", { via: localStorage.getItem("pivot_share_token") ? "share_referral" : "direct" });
              onAuth(data);
            } else {
              setError(data.reason || "Access denied.");
            }
          } catch {
            setError(t.signInFailed);
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
      backgroundColor: theme.bg,
      color: theme.textPrimary,
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
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontSize: 48, fontWeight: 800, letterSpacing: "0.05em",
          color: "#FF6B2B", lineHeight: 1,
        }}>PIVOT</div>
        <div style={{
          fontSize: 12, color: theme.textSecondary,
          letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 6,
        }}>Basketball · BCN</div>
      </div>

      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 16,
        padding: "32px 28px",
        textAlign: "center",
        width: "100%",
        maxWidth: 320,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏀</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.textBright, marginBottom: 6 }}>
          {t.familyOnly}
        </div>
        <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 24, lineHeight: 1.5 }}>
          {t.signInPrompt}
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: theme.textSecondary, padding: "12px 0" }}>{t.signingIn}</div>
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

      <div style={{ marginTop: 24, fontSize: 11, color: theme.textMuted }}>
        Rohan & Sara · 2025–26
      </div>
    </div>
  );
}

import { useState } from "react";
import { S } from "./styles";

const CATEGORIES = ["Benjamí", "Aleví", "Infantil", "Cadet", "Junior", "Sènior"];
const COLORS = ["#FF6B2B", "#A855F7", "#22d3a0", "#3B82F6", "#F59E0B", "#EF4444"];
const EMPTY_KID = { name: "", label: "", fcbqTeamId: "", category: "Infantil", gender: "M", grupIdPhase1: "", grupIdPhase2: "", color: "#FF6B2B" };

function KidForm({ kid, index, onChange, onRemove, canRemove }) {
  const set = (field, val) => onChange({ ...kid, [field]: val });

  return (
    <div style={{ background: "#111827", border: `1px solid ${kid.color}44`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: kid.color }}>Kid {index + 1}</div>
        {canRemove && (
          <button onClick={onRemove} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>Remove</button>
        )}
      </div>

      {/* Color picker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => set("color", c)} style={{
            width: 24, height: 24, borderRadius: "50%", background: c, border: `2px solid ${kid.color === c ? "white" : "transparent"}`,
            cursor: "pointer", padding: 0,
          }} />
        ))}
      </div>

      {/* Name + label */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={S.label}>Full name</div>
          <input value={kid.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Pau Garcia"
            style={inputStyle} />
        </div>
        <div>
          <div style={S.label}>Short name</div>
          <input value={kid.label} onChange={e => set("label", e.target.value)} placeholder="e.g. Pau"
            style={inputStyle} />
        </div>
      </div>

      {/* Category + Gender */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={S.label}>Category</div>
          <select value={kid.category} onChange={e => set("category", e.target.value)} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>Gender</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {["M", "F"].map(g => (
              <button key={g} onClick={() => set("gender", g)} style={{
                flex: 1, background: kid.gender === g ? kid.color : "#0f172a",
                border: `1px solid ${kid.gender === g ? kid.color : "rgba(255,255,255,0.1)"}`,
                borderRadius: 6, padding: "6px 0", color: kid.gender === g ? "white" : "#64748b",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{g === "M" ? "♂ Boy" : "♀ Girl"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* FCBQ Team ID */}
      <div style={{ marginBottom: 10 }}>
        <div style={S.label}>FCBQ Team ID</div>
        <input value={kid.fcbqTeamId} onChange={e => set("fcbqTeamId", e.target.value)}
          placeholder="e.g. 80316 — from basquetcatala.cat/equip/XXXXX"
          style={inputStyle} type="number" />
      </div>

      {/* Grup IDs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={S.label}>Grup ID — Phase 1</div>
          <input value={kid.grupIdPhase1} onChange={e => set("grupIdPhase1", e.target.value)}
            placeholder="e.g. 19848" style={inputStyle} type="number" />
        </div>
        <div>
          <div style={S.label}>Grup ID — Phase 2 (optional)</div>
          <input value={kid.grupIdPhase2} onChange={e => set("grupIdPhase2", e.target.value)}
            placeholder="e.g. 21202" style={inputStyle} type="number" />
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>
        Find Grup IDs on basquetcatala.cat → your kid's competition page → URL contains the grup number
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6, padding: "7px 10px", color: "#e2e8f0", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

export default function SetupScreen({ user, onSave }) {
  const [kids, setKids] = useState([{ ...EMPTY_KID }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateKid = (i, kid) => setKids(ks => ks.map((k, idx) => idx === i ? kid : k));
  const addKid = () => { if (kids.length < 3) setKids(ks => [...ks, { ...EMPTY_KID, color: COLORS[ks.length] }]); };
  const removeKid = (i) => setKids(ks => ks.filter((_, idx) => idx !== i));

  const isValid = kids.every(k => k.name.trim() && k.label.trim() && k.grupIdPhase1.trim());

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, kids }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSave();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      backgroundColor: "#070912", color: "#e2e8f0",
      minHeight: "100vh", maxWidth: 520, margin: "0 auto", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070912; }
        select option { background: #111827; }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: "#FF6B2B" }}>PIVOT</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginTop: 8 }}>Set up your family</div>
        <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
          Hi {user.name?.split(" ")[0]} — add up to 3 kids to get started.
        </div>
      </div>

      {kids.map((kid, i) => (
        <KidForm key={i} kid={kid} index={i} onChange={k => updateKid(i, k)}
          onRemove={() => removeKid(i)} canRemove={kids.length > 1} />
      ))}

      {kids.length < 3 && (
        <button onClick={addKid} style={{
          width: "100%", background: "transparent", border: "1px dashed rgba(255,255,255,0.15)",
          borderRadius: 10, padding: "10px 0", color: "#475569", fontSize: 13, cursor: "pointer", marginBottom: 16,
        }}>
          + Add another kid
        </button>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#ff4757", background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!isValid && (
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
          Name, short name, and Phase 1 Grup ID are required for each kid.
        </div>
      )}

      <button onClick={save} disabled={!isValid || saving} style={{
        ...S.primaryBtn,
        opacity: (!isValid || saving) ? 0.5 : 1,
        cursor: (!isValid || saving) ? "not-allowed" : "pointer",
      }}>
        {saving ? "Saving…" : "Save & Open PIVOT →"}
      </button>
    </div>
  );
}

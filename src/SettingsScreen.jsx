import { useState } from "react";
import { S } from "./styles";
import { useLang } from "./LangContext";
import { KidForm, EMPTY_KID, COLORS } from "./SetupScreen";

const LANG_PILLS = [
  { id: "cat", label: "CAT" },
  { id: "es",  label: "ES" },
  { id: "en",  label: "EN" },
];

// buildKid() in familyUtils shapes kids differently from the setup/KidForm shape.
// This normalises back to the shape KidForm expects before editing.
function toEditShape(kid) {
  return {
    name: kid.name || "",
    label: kid.label || "",
    clubName: kid.clubName || "",
    fcbqTeamId: kid.fcbqTeamId || kid.fcbqId || "",
    category: kid.category || "Infantil",
    gender: kid.gender || "M",
    grupIdPhase1: kid.grupIdPhase1 || kid.grupIds?.[0] || "",
    grupIdPhase2: kid.grupIdPhase2 || kid.grupIds?.[1] || "",
    color: kid.color || "#FF6B2B",
  };
}

export default function SettingsScreen({ user, kids: initialKids, onSave, onClose }) {
  const { lang, setLanguage, t } = useLang();
  const [editKids, setEditKids] = useState(() => initialKids.map(toEditShape));
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [deleteConfirm, setDeleteConfirm] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateKid = (i, kid) => setEditKids(ks => ks.map((k, idx) => idx === i ? kid : k));

  const toggleEdit = (i) => {
    setExpandedIndex(prev => prev === i ? -1 : i);
    setDeleteConfirm(-1);
  };

  const requestDelete = (i) => {
    setDeleteConfirm(i);
    setExpandedIndex(-1);
  };

  const doDelete = (i) => {
    setEditKids(ks => ks.filter((_, idx) => idx !== i));
    setDeleteConfirm(-1);
    if (expandedIndex === i) setExpandedIndex(-1);
    else if (expandedIndex > i) setExpandedIndex(expandedIndex - 1);
  };

  const addKid = () => {
    if (editKids.length < 3) {
      const newIndex = editKids.length;
      setEditKids(ks => [...ks, { ...EMPTY_KID, color: COLORS[ks.length] }]);
      setExpandedIndex(newIndex);
    }
  };

  const isValid = editKids.length > 0 &&
    editKids.every(k => k.name.trim() && k.label.trim() && k.grupIdPhase1.trim());

  const save = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, kids: editKids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070912; }
        select option { background: #111827; }
      `}</style>

      {/* Header */}
      <div style={{ ...S.header, marginBottom: 20 }}>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          ← {t.back}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {LANG_PILLS.map(({ id, label }) => (
              <button key={id} onClick={() => setLanguage(id)} style={{
                background: lang === id ? "rgba(255,107,43,0.15)" : "transparent",
                border: `1px solid ${lang === id ? "rgba(255,107,43,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 4, padding: "2px 6px", cursor: "pointer",
                color: lang === id ? "#FF6B2B" : "#334155", fontSize: 9, fontWeight: 600,
                letterSpacing: "0.05em",
              }}>{label}</button>
            ))}
          </div>
          <button
            onClick={save}
            disabled={!isValid || saving}
            style={{
              background: (!isValid || saving) ? "rgba(255,107,43,0.1)" : "rgba(255,107,43,0.15)",
              border: `1px solid ${(!isValid || saving) ? "rgba(255,107,43,0.2)" : "rgba(255,107,43,0.4)"}`,
              borderRadius: 6, padding: "4px 14px",
              cursor: (!isValid || saving) ? "not-allowed" : "pointer",
              color: (!isValid || saving) ? "rgba(255,107,43,0.4)" : "#FF6B2B",
              fontSize: 12, fontWeight: 600,
            }}
          >
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      </div>

      <div style={{ padding: "0 20px 40px" }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 22, fontWeight: 700, color: "#94a3b8",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16,
        }}>
          {t.settings}
        </div>

        {editKids.map((kid, i) => (
          <div key={i} style={{ marginBottom: expandedIndex === i ? 0 : 10 }}>
            {/* Summary card */}
            <div style={{
              background: "#111827",
              border: `1px solid ${expandedIndex === i ? kid.color + "55" : "rgba(255,255,255,0.07)"}`,
              borderRadius: expandedIndex === i ? "12px 12px 0 0" : 12,
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: kid.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                      {kid.name || t.kidN(i + 1)}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                      {[kid.category, kid.clubName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={() => toggleEdit(i)}
                    style={{
                      background: expandedIndex === i ? "rgba(255,107,43,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${expandedIndex === i ? "rgba(255,107,43,0.3)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 6, padding: "3px 10px",
                      color: expandedIndex === i ? "#FF6B2B" : "#64748b",
                      fontSize: 11, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    {expandedIndex === i ? "✕" : t.editKid}
                  </button>
                  {deleteConfirm === i ? (
                    <>
                      <button
                        onClick={() => doDelete(i)}
                        style={{
                          background: "rgba(255,71,87,0.15)", border: "1px solid rgba(255,71,87,0.3)",
                          borderRadius: 6, padding: "3px 8px", color: "#ff4757", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}
                      >{t.yes}</button>
                      <button
                        onClick={() => setDeleteConfirm(-1)}
                        style={{
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6, padding: "3px 8px", color: "#64748b", fontSize: 11, cursor: "pointer",
                        }}
                      >{t.no}</button>
                    </>
                  ) : (
                    <button
                      onClick={() => requestDelete(i)}
                      style={{
                        background: "none", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 6, padding: "3px 8px", color: "#475569", fontSize: 13, cursor: "pointer",
                      }}
                    >🗑</button>
                  )}
                </div>
              </div>
              {deleteConfirm === i && (
                <div style={{ fontSize: 11, color: "#ff4757", marginTop: 8 }}>{t.confirmDelete}</div>
              )}
            </div>

            {/* Inline expanded edit form */}
            {expandedIndex === i && (
              <div style={{
                border: `1px solid ${kid.color}55`,
                borderTop: "none",
                borderRadius: "0 0 12px 12px",
                background: "#0d1420",
                padding: 16,
                marginBottom: 10,
              }}>
                <KidForm
                  kid={kid}
                  index={i}
                  onChange={k => updateKid(i, k)}
                  onRemove={() => {}}
                  canRemove={false}
                />
              </div>
            )}
          </div>
        ))}

        {editKids.length < 3 && (
          <button
            onClick={addKid}
            style={{
              width: "100%", background: "transparent",
              border: "1px dashed rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "10px 0",
              color: "#475569", fontSize: 13, cursor: "pointer", marginBottom: 16,
            }}
          >
            {t.addKid}
          </button>
        )}

        {!isValid && (
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
            {t.setupRequired}
          </div>
        )}

        {error && (
          <div style={{
            fontSize: 13, color: "#ff4757",
            background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.25)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 12,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

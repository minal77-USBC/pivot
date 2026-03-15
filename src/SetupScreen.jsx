import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import { useLang } from "./LangContext";
import { useTheme } from "./ThemeContext";

const CATEGORIES = ["Premini", "Mini", "Infantil", "Cadet", "Junior", "Sènior"];
export const COLORS = ["#FF6B2B", "#A855F7", "#22d3a0", "#3B82F6", "#F59E0B", "#EF4444"];
export const EMPTY_KID = { name: "", label: "", clubName: "", fcbqTeamId: "", category: "Infantil", gender: "M", grupIdPhase1: "", grupIdPhase2: "", color: "#FF6B2B" };

function positiveInt(val) {
  return val.replace(/[^0-9]/g, "");
}

export function KidForm({ kid, index, onChange, onRemove, canRemove }) {
  const { t } = useLang();
  const { S, theme } = useTheme();
  const set = (field, val) => onChange({ ...kid, [field]: val });

  const inputStyle = {
    width: "100%", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
    borderRadius: 6, padding: "7px 10px", color: theme.textPrimary, fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const [clubSearch, setClubSearch] = useState(kid.clubName || "");
  const [clubResults, setClubResults] = useState([]);
  const [showClubDrop, setShowClubDrop] = useState(false);
  const [clubLocked, setClubLocked] = useState(!!kid.fcbqTeamId);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [grupLoading, setGrupLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [autoFilled, setAutoFilled] = useState(!!kid.fcbqTeamId);
  const [categoryLocked, setCategoryLocked] = useState(!!kid.fcbqTeamId);
  const clubRef = useRef(null);

  // Debounced club search
  useEffect(() => {
    if (clubSearch.length < 2) { setClubResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/clubs-search?q=${encodeURIComponent(clubSearch)}`)
        .then(r => r.json())
        .then(data => { setClubResults(data); setShowClubDrop(data.length > 0); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [clubSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => { if (clubRef.current && !clubRef.current.contains(e.target)) setShowClubDrop(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectClub = (club) => {
    track("club_selected", { clubName: club.name });
    set("clubName", club.name);
    setClubSearch(club.name);
    setShowClubDrop(false);
    setClubLocked(true);
    setTeams([]);
    setAutoFilled(false);
    setSelectedTeam(null);
    setTeamsLoading(true);
    fetch(`/api/club-teams?clubId=${club.id}`)
      .then(r => r.json())
      .then(t => { setTeams(Array.isArray(t) ? t : []); setTeamsLoading(false); })
      .catch(() => setTeamsLoading(false));
  };

  const changeClub = () => {
    setClubLocked(false);
    setClubSearch("");
    setTeams([]);
    setAutoFilled(false);
    setSelectedTeam(null);
    setCategoryLocked(false);
    onChange({ ...kid, clubName: "", fcbqTeamId: "", grupIdPhase1: "", grupIdPhase2: "" });
  };

  const selectTeam = (team) => {
    track("team_selected", { category: kid.category, gender: kid.gender });
    setGrupLoading(true);
    fetch(`/api/team-grups?teamId=${team.teamId}`)
      .then(r => r.json())
      .then(data => {
        onChange({
          ...kid,
          fcbqTeamId: data.fcbqTeamId || "",
          grupIdPhase1: data.grupIdPhase1 || "",
          grupIdPhase2: data.grupIdPhase2 || "",
        });
        setSelectedTeam(team);
        setAutoFilled(true);
        setCategoryLocked(true);
        setGrupLoading(false);
      })
      .catch(() => setGrupLoading(false));
  };

  const changeTeam = () => {
    setSelectedTeam(null);
    setAutoFilled(false);
    setCategoryLocked(false);
    onChange({ ...kid, fcbqTeamId: "", grupIdPhase1: "", grupIdPhase2: "" });
  };

  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${kid.color}44`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: kid.color }}>{t.kidN(index + 1)}</div>
        {canRemove && (
          <button onClick={onRemove} style={{ background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: 12 }}>{t.remove}</button>
        )}
      </div>

      {/* Color picker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => set("color", c)} style={{
            width: 24, height: 24, borderRadius: "50%", background: c,
            border: `2px solid ${kid.color === c ? "white" : "transparent"}`,
            cursor: "pointer", padding: 0,
          }} />
        ))}
      </div>

      {/* Name + label */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={S.label}>{t.fullName}</div>
          <input value={kid.name} onChange={e => set("name", e.target.value)} placeholder={t.namePlaceholder} style={inputStyle} />
        </div>
        <div>
          <div style={S.label}>{t.shortName}</div>
          <input value={kid.label} onChange={e => set("label", e.target.value)} placeholder={t.labelPlaceholder} style={inputStyle} />
        </div>
      </div>

      {/* Category + Gender */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={S.label}>{t.category}</div>
          {categoryLocked ? (
            <div style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "default" }}>
              <span style={{ color: theme.textBright, fontWeight: 500 }}>{kid.category}</span>
              <button type="button" onClick={() => setCategoryLocked(false)}
                style={{ background: "none", border: "none", color: theme.textDim, fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                {t.change}
              </button>
            </div>
          ) : (
            <select value={kid.category} onChange={e => set("category", e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div>
          <div style={S.label}>{t.gender}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {["M", "F"].map(g => (
              <button key={g} onClick={() => set("gender", g)} style={{
                flex: 1, background: kid.gender === g ? kid.color : theme.inputBg,
                border: `1px solid ${kid.gender === g ? kid.color : theme.inputBorder}`,
                borderRadius: 6, padding: "6px 0", color: kid.gender === g ? "white" : theme.textDim,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{g === "M" ? t.boy : t.girl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Club search with autocomplete */}
      <div style={{ marginBottom: 10 }} ref={clubRef}>
        <div style={S.label}>{t.clubName}</div>
        {clubLocked ? (
          <div style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "default" }}>
            <span style={{ color: theme.textBright, fontWeight: 500 }}>{kid.clubName}</span>
            <button type="button" onClick={changeClub}
              style={{ background: "none", border: "none", color: theme.textDim, fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              {t.change}
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              value={clubSearch}
              onChange={e => { setClubSearch(e.target.value); set("clubName", e.target.value); }}
              onFocus={() => clubResults.length > 0 && setShowClubDrop(true)}
              placeholder={t.clubPlaceholder}
              style={inputStyle}
            />
            {showClubDrop && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
                borderRadius: 8, marginTop: 2, overflow: "hidden",
              }}>
                {clubResults.map(club => (
                  <div key={club.id} onMouseDown={() => selectClub(club)} style={{
                    padding: "9px 12px", cursor: "pointer", fontSize: 13,
                    borderBottom: `1px solid ${theme.rowBorder}`,
                  }}>
                    <span style={{ color: theme.textBright, fontWeight: 500 }}>{club.name}</span>
                    <span style={{ color: theme.textDim, fontSize: 11, marginLeft: 6 }}>{club.town}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team picker — appears after club selected, locks after team selected */}
      {(teams.length > 0 || teamsLoading) && (
        <div style={{ marginBottom: 10 }}>
          <div style={S.label}>{t.selectTeam}</div>
          {teamsLoading ? (
            <div style={{ fontSize: 12, color: theme.textDim, padding: "8px 0" }}>{t.loadingTeams}</div>
          ) : autoFilled && selectedTeam ? (
            <div style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "default" }}>
              <span style={{ color: theme.textBright, fontWeight: 500 }}>
                {selectedTeam.name}{selectedTeam.category ? ` — ${selectedTeam.category}` : ""}
              </span>
              <button type="button" onClick={changeTeam}
                style={{ background: "none", border: "none", color: theme.textDim, fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                {t.change}
              </button>
            </div>
          ) : (
            <select
              defaultValue=""
              onChange={e => {
                const team = teams.find(tm => tm.teamId === e.target.value);
                if (team) selectTeam(team);
              }}
              style={inputStyle}
            >
              <option value="" disabled>{t.pickTeam}</option>
              {teams.map(t => (
                <option key={t.teamId} value={t.teamId}>
                  {t.name}{t.category ? ` — ${t.category}` : ""}
                </option>
              ))}
            </select>
          )}
          {grupLoading && <div style={{ fontSize: 11, color: "#22d3a0", marginTop: 4 }}>{t.fetchingIds}</div>}  {/* accent colour — intentional */}
        </div>
      )}

      {/* FCBQ Team ID + Grup IDs — auto-filled via team picker, locked until then */}
      <div style={{ marginBottom: 10 }}>
        <div style={S.label}>{t.fcbqTeamId}</div>
        <input value={kid.fcbqTeamId} onChange={e => set("fcbqTeamId", positiveInt(e.target.value))}
          placeholder="e.g. 80316"
          style={{ ...inputStyle, ...(autoFilled ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}
          inputMode="numeric" readOnly={!autoFilled} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={S.label}>{t.grupPhase1}</div>
          <input value={kid.grupIdPhase1} onChange={e => set("grupIdPhase1", positiveInt(e.target.value))}
            placeholder="e.g. 19848"
            style={{ ...inputStyle, ...(autoFilled ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}
            inputMode="numeric" readOnly={!autoFilled} />
        </div>
        <div>
          <div style={S.label}>{t.grupPhase2}</div>
          <input value={kid.grupIdPhase2} onChange={e => set("grupIdPhase2", positiveInt(e.target.value))}
            placeholder="e.g. 21202"
            style={{ ...inputStyle, ...(autoFilled ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}
            inputMode="numeric" readOnly={!autoFilled} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div style={{ fontSize: 10, color: theme.textMuted }}>{t.idsHint}</div>
        {!autoFilled && (
          <button type="button" onClick={() => setAutoFilled(true)}
            style={{ background: "none", border: "none", color: theme.textDim, fontSize: 10, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            {t.enterManually}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SetupScreen({ user, onSave }) {
  const { t } = useLang();
  const { S, theme } = useTheme();
  const [kids, setKids] = useState([{ ...EMPTY_KID }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const completedRef = useRef(false);
  const kidsRef = useRef(kids);
  useEffect(() => { kidsRef.current = kids; }, [kids]);

  useEffect(() => { track("setup_started"); }, []);

  useEffect(() => {
    return () => {
      if (!completedRef.current) {
        const current = kidsRef.current;
        track("setup_abandoned", {
          kidCount: current.length,
          hasClub: !!current[0]?.clubName,
          hasTeam: !!current[0]?.grupIdPhase1,
        });
      }
    };
  }, []);

  const updateKid = (i, kid) => setKids(ks => ks.map((k, idx) => idx === i ? kid : k));
  const addKid = () => { if (kids.length < 3) setKids(ks => [...ks, { ...EMPTY_KID, color: COLORS[ks.length] }]); };
  const removeKid = (i) => setKids(ks => ks.filter((_, idx) => idx !== i));

  const isValid = kids.every(k => k.name.trim() && k.label.trim() && k.grupIdPhase1.trim());

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const credential = sessionStorage.getItem("pivot_credential");
      const res = await fetch("/api/family", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        },
        body: JSON.stringify({ email: user.email, kids }),
      });
      if (res.status === 403) {
        sessionStorage.removeItem("pivot_auth");
        sessionStorage.removeItem("pivot_credential");
        window.location.reload();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      completedRef.current = true;
      track("setup_completed", { kidCount: kids.length, categories: kids.map(k => k.category).join(",") });
      onSave();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      backgroundColor: theme.bg, color: theme.textPrimary,
      minHeight: "100vh", maxWidth: 520, margin: "0 auto", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${theme.bg}; }
        select option { background: ${theme.cardBg}; }
        input:focus, select:focus { outline: 2px solid rgba(255,107,43,0.4) !important; outline-offset: 1px; }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: "#FF6B2B" }}>PIVOT</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.textBright, marginTop: 8 }}>{t.setupTitle}</div>
        <div style={{ fontSize: 13, color: theme.textDim, marginTop: 4 }}>
          {t.setupSubtitle(user.name?.split(" ")[0])}
        </div>
      </div>

      {kids.map((kid, i) => (
        <KidForm key={i} kid={kid} index={i} onChange={k => updateKid(i, k)}
          onRemove={() => removeKid(i)} canRemove={kids.length > 1} />
      ))}

      {kids.length < 3 && (
        <button onClick={addKid} style={{
          width: "100%", background: "transparent", border: `1px dashed ${theme.cardBorder}`,
          borderRadius: 10, padding: "10px 0", color: theme.textDim, fontSize: 13, cursor: "pointer", marginBottom: 16,
        }}>
          {t.addKid}
        </button>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#ff4757", background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!isValid && (
        <div style={{ fontSize: 11, color: theme.textDim, marginBottom: 10 }}>
          {t.setupRequired}
        </div>
      )}

      <button onClick={save} disabled={!isValid || saving} style={{
        ...S.primaryBtn,
        opacity: (!isValid || saving) ? 0.5 : 1,
        cursor: (!isValid || saving) ? "not-allowed" : "pointer",
      }}>
        {saving ? t.saving : t.saveBtn}
      </button>
    </div>
  );
}

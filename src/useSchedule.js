import { useState, useEffect, useRef } from "react";

const CACHE_KEY = "pivot_schedule_v2";
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

// Collapses the per-kid meta into a single "oldest data is from X" timestamp
// for the banner. Returns null when nothing was served from cache.
function withFetchedAt(meta) {
  if (!meta?.stale) return null;
  const stamps = Object.values(meta.kids || {})
    .map(k => k?.fetchedAt)
    .filter(Boolean)
    .sort();
  return { ...meta, fetchedAt: stamps[0] || null };
}

function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
}

export function useSchedule(kids) {
  const [kidMatches, setKidMatches] = useState({});
  // Set when /api/schedule served any grup from the durable fixture cache
  // because ESB was unreachable. Drives the stale banner in App.jsx.
  const [staleInfo, setStaleInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchRef = useRef(0);

  // Cache key is unique per family's grup ID combination
  const cacheKey = kids?.length
    ? `${CACHE_KEY}:${kids.map(k => `${k.id}:${(k.grupIds || []).join(",")}`).join("|")}`
    : null;

  const doFetch = async (force = false) => {
    if (!kids?.length) { setKidMatches({}); setLoading(false); return; }

    if (!force) {
      const cached = getCached(cacheKey);
      if (cached) {
        const { _meta, ...data } = cached;
        setKidMatches(data);
        setStaleInfo(withFetchedAt(_meta));
        setLoading(false);
        return;
      }
    }

    const id = ++fetchRef.current;
    setLoading(true);
    setError(null);

    try {
      const param = encodeURIComponent(JSON.stringify(
        kids.map(k => ({ id: k.id, grupIds: k.grupIds || [], teamId: k.teamId }))
      ));
      const res = await fetch(`/api/schedule?kids=${param}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (fetchRef.current !== id) return;
      // _meta rides alongside the kid-id keys; strip it so downstream consumers
      // only ever see { [kidId]: matches[] }.
      const { _meta, ...data } = payload;
      setCache(cacheKey, payload);
      setKidMatches(data);
      setStaleInfo(withFetchedAt(_meta));
    } catch (e) {
      if (fetchRef.current === id) setError(e.message);
    } finally {
      if (fetchRef.current === id) setLoading(false);
    }
  };

  useEffect(() => {
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Re-check when the app comes back to the foreground.
  //
  // Mount is the only other trigger, so a session left open never refreshes on
  // its own — a parent who has had the app open in a pocket for two hours would
  // miss a same-day kick-off or venue change. doFetch() is not forced, so a
  // cache entry still inside its 5-minute TTL short-circuits and costs nothing.
  const doFetchRef = useRef(doFetch);
  doFetchRef.current = doFetch;

  useEffect(() => {
    if (!cacheKey) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") doFetchRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [cacheKey]);

  return { kidMatches, staleInfo, loading, error, refresh: () => doFetch(true) };
}

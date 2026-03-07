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

function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
}

export function useSchedule(kids) {
  const [kidMatches, setKidMatches] = useState({});
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
      if (cached) { setKidMatches(cached); setLoading(false); return; }
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
      const data = await res.json();
      if (fetchRef.current !== id) return;
      setCache(cacheKey, data);
      setKidMatches(data);
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

  return { kidMatches, loading, error, refresh: () => doFetch(true) };
}

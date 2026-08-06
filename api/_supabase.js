// Server-only — minimal Supabase REST reader for the FCBQ index endpoints.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export async function sbSelect(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// PostgREST treats , . : ( ) as operator syntax inside filter values
export function escapeFilter(value) {
  return String(value).replace(/[,.():*]/g, " ").trim();
}

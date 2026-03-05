const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { ...sbHeaders, ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  const { email } = req.method === "GET" ? req.query : req.body || {};

  if (!email) return res.status(400).json({ error: "Missing email" });

  // GET — load family config
  if (req.method === "GET") {
    const rows = await sb(
      `/families?email=eq.${encodeURIComponent(email)}&select=*,kids(*)&kids.order=sort_order.asc`
    ).catch(() => []);

    if (!rows.length) return res.json({ family: null });

    const family = rows[0];
    return res.json({ family });
  }

  // POST — save (upsert) family config
  if (req.method === "POST") {
    const { kids = [] } = req.body || {};

    // Upsert family row
    const [family] = await sb(
      `/families?email=eq.${encodeURIComponent(email)}`,
      {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify({ email }),
      }
    );

    const familyId = family.id;

    // Replace kids: delete existing, insert new
    await sb(`/kids?family_id=eq.${familyId}`, { method: "DELETE" });

    if (kids.length) {
      await sb("/kids", {
        method: "POST",
        body: JSON.stringify(
          kids.map((k, i) => ({
            family_id: familyId,
            sort_order: i,
            name: k.name,
            label: k.label,
            fcbq_team_id: k.fcbqTeamId || null,
            category: k.category,
            gender: k.gender || "M",
            grup_id_phase1: k.grupIdPhase1 || null,
            grup_id_phase2: k.grupIdPhase2 || null,
            color: k.color || "#FF6B2B",
          }))
        ),
      });
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}

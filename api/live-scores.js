export const access = "public";
export const methods = ["GET"];

const cache = { at: 0, data: null };
const CACHE_MS = 30_000;

function normalizeEvent(event) {
  const comp = event?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find(c => c.homeAway === "home") || competitors[0];
  const away = competitors.find(c => c.homeAway === "away") || competitors[1];
  const status = event?.status || {};
  const clock = status?.displayClock || "";
  const period = status?.period || 0;
  const state = status?.type?.state || "pre";
  return {
    id: event?.id,
    name: event?.name || "",
    shortName: event?.shortName || "",
    date: event?.date || null,
    state,
    status: status?.type?.shortDetail || status?.type?.detail || "",
    clock,
    period,
    home: home?.team?.displayName || "",
    away: away?.team?.displayName || "",
    homeScore: Number(home?.score ?? 0),
    awayScore: Number(away?.score ?? 0),
    venue: comp?.venue?.fullName || "",
    broadcast: (comp?.broadcasts || []).flatMap(b => b.names || []).slice(0,3),
    incidents: (comp?.details || event?.details || []).slice(-12).map(d=>({type:d.type?.text||d.type?.name||d.type||"",text:d.text||d.description||"",clock:d.clock?.displayValue||d.clock?.value||d.displayClock||""})).filter(x=>x.text||x.type),
    links: (event?.links || []).map(l => ({rel:l.rel?.[0] || "", href:l.href || ""})).filter(x=>x.href)
  };
}

export default async function (req, res) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return res.json(cache.data);
  }

  try {
    const url = "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard";
    const response = await fetch(url, { headers: { "User-Agent": "RadarNoticias/1.0" } });
    if (!response.ok) throw new Error("Fonte de placar retornou HTTP " + response.status);
    const payload = await response.json();
    const events = Array.isArray(payload?.events) ? payload.events.map(normalizeEvent) : [];
    const data = {
      source: "ESPN",
      updatedAt: new Date().toISOString(),
      live: events.filter(e => e.state === "in"),
      today: events
    };
    cache.at = Date.now();
    cache.data = data;
    res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
    return res.json(data);
  } catch (error) {
    return res.status(502).json({ error: "Não foi possível consultar o placar ao vivo.", detail: String(error?.message || error) });
  }
}
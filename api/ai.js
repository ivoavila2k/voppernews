import { ai } from "hatchable";

export const access = "public";
export const methods = ["POST"];

const CACHE_MS = 20_000;
const cache = new Map();

function cleanText(value, max = 1200) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": "VopperNews/1.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function footballContext(question) {
  const now = new Date().toISOString();
  const context = { now, standings: [], fixtures: [], live: [], news: [] };

  const [standings, fixtures, live, news] = await Promise.allSettled([
    fetchJson("https://site.api.espn.com/apis/v2/sports/soccer/bra.1/standings"),
    fetchJson("https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"),
    fetchJson("https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"),
    fetchJson("https://radar-noticias.hatchable.site/api/news?limit=20&category=Todas")
  ]);

  if (standings.status === "fulfilled") {
    const entries = (standings.value?.children || []).flatMap(g => g?.standings?.entries || []);
    context.standings = entries.slice(0, 20).map((e, i) => {
      const stats = Object.fromEntries((e.stats || []).map(s => [s.name, Number(s.value) || 0]));
      return {
        rank: Number(e.rank || i + 1),
        team: e.team?.displayName || e.team?.name || "",
        points: stats.points || 0,
        games: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        draws: stats.ties || 0,
        losses: stats.losses || 0,
        goalsFor: stats.pointsFor || 0,
        goalsAgainst: stats.pointsAgainst || 0,
        goalDiff: stats.differential ?? ((stats.pointsFor || 0) - (stats.pointsAgainst || 0))
      };
    }).filter(x => x.team);
  }

  const scoreboards = [];
  if (fixtures.status === "fulfilled") scoreboards.push(fixtures.value);
  if (live.status === "fulfilled") scoreboards.push(live.value);
  const seen = new Set();

  for (const board of scoreboards) {
    for (const event of board?.events || []) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const c = event.competitions?.[0];
      const h = c?.competitors?.find(x => x.homeAway === "home");
      const a = c?.competitors?.find(x => x.homeAway === "away");
      if (!h || !a) continue;
      context.fixtures.push({
        id: event.id,
        date: event.date,
        status: c?.status?.type?.shortDetail || c?.status?.type?.description || "",
        state: c?.status?.type?.state || "",
        home: h.team?.displayName || "",
        away: a.team?.displayName || "",
        homeScore: Number(h.score || 0),
        awayScore: Number(a.score || 0)
      });
    }
  }

  if (news.status === "fulfilled" && Array.isArray(news.value)) {
    context.news = news.value.slice(0, 20).map(n => ({
      title: cleanText(n.title, 300),
      summary: cleanText(n.summary, 600),
      source: cleanText(n.source, 80),
      published_at: n.published_at || null,
      url: n.url || ""
    }));
  }

  return context;
}

export default async function (req, res) {
  const question = cleanText(req.body?.question, 700);
  if (!question) return res.status(400).json({ error: "Digite uma pergunta sobre futebol." });

  const cacheKey = question.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.json(hit.data);

  try {
    const context = await footballContext(question);
    const { text: answer } = await ai.generateText({
      model: "gemini",
      purpose: "football-news-assistant",
      system: `Você é o Vopper AI, assistente de futebol do portal Vopper News.
Responda em português do Brasil, de forma clara, natural e objetiva.
Use SOMENTE os dados fornecidos no contexto para fatos atuais. Se algo não estiver no contexto, diga que não há dados suficientes em vez de inventar.
Pode explicar, comparar estatísticas, resumir notícias, analisar campanhas e responder perguntas sobre times, jogadores, partidas e competições quando os dados disponíveis permitirem.
Não apresente apostas, odds ou recomendações de aposta.
Não invente lesões, escalações, transferências ou resultados.
Não faça previsão própria de vencedor, probabilidade ou "quem vai ganhar". Se o usuário pedir previsão, explique que você não pode prever o resultado e ofereça uma comparação factual baseada nos dados disponíveis.
Quando usar uma notícia, cite a fonte pelo nome e, quando houver URL, inclua o link em Markdown.
Data/hora de referência: ${context.now}.`,
      prompt: `Pergunta do usuário:
${question}

Dados atuais disponíveis:
${JSON.stringify(context)}`
    });

    const data = {
      answer: String(answer || "").trim(),
      updatedAt: new Date().toISOString(),
      sources: ["ESPN", "Vopper News"]
    };
    cache.set(cacheKey, { at: Date.now(), data });
    res.setHeader("Cache-Control", "private, max-age=20");
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      error: "O Vopper AI não conseguiu consultar os dados agora.",
      detail: String(error?.message || error)
    });
  }
}
export const access = "public";
export const methods = ["GET"];

const CACHE_MS = 45 * 60 * 1000;
let cache = { at: 0, data: [] };

const FEEDS = [
  { name: "UOL Esporte", channel: "UC3KHYFWeB0WimMBfm3NEahQ" },
  { name: "ge", channel: "UCgCKagVhzGnZcuP9bSMgMCg" }
];

function clean(s) {
  return String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

function parseFeed(xml, source) {
  const items = [];
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  for (const block of blocks) {
    const id = clean((block.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i) || [])[1]);
    const title = clean((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    const published = clean((block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || [])[1]);
    const channelTitle = clean((block.match(/<name[^>]*>([\s\S]*?)<\/name>/i) || [])[1]) || source;
    if (!id || !title) continue;
    items.push({
      id,
      title,
      publishedAt: published,
      channelTitle,
      source,
      url: "https://www.youtube.com/watch?v=" + id,
      embedUrl: "https://www.youtube-nocookie.com/embed/" + id + "?rel=0"
    });
  }
  return items;
}

export default async function (req, res) {
  if (cache.data.length && Date.now() - cache.at < CACHE_MS) {
    res.setHeader("Cache-Control", "public, max-age=2700, stale-while-revalidate=5400");
    return res.json({ source: "YouTube RSS", updatedAt: new Date(cache.at).toISOString(), videos: cache.data });
  }

  try {
    const settled = await Promise.allSettled(FEEDS.map(async feed => {
      const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + feed.channel, {
        headers: { "User-Agent": "VopperNews/1.0" }
      });
      if (!r.ok) throw new Error(feed.name + " RSS HTTP " + r.status);
      return parseFeed(await r.text(), feed.name);
    }));

    const results = settled
      .filter(x => x.status === "fulfilled")
      .map(x => x.value);

    const terms = /(brasileirão|brasileiro|futebol|gol|gols|melhores momentos|melhores lances|jogo|partida|libertadores|copa|palmeiras|flamengo|corinthians|grêmio|internacional|são paulo|botafogo|santos|cruzeiro|fluminense|vasco|bahia|atlético|sport|fortaleza)/i;
    const exclude = /(bets?|apostas?|betting|odds|cassino|casa de apostas)/i;
    const seen = new Set();
    const videos = results.flat()
      .filter(v => terms.test(v.title))
      .filter(v => !exclude.test(v.title))
      .filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      })
      .sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 8);

    cache = { at: Date.now(), data: videos };
    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=1200");
    return res.json({ source: "YouTube RSS", updatedAt: new Date(cache.at).toISOString(), videos });
  } catch (error) {
    return res.status(502).json({
      error: "Não foi possível atualizar os vídeos agora.",
      detail: String(error?.message || error)
    });
  }
}
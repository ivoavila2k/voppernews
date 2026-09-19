import { db } from "hatchable";

export const access = "public";
export const methods = ["GET"];

const CATEGORIES = new Set(["Todas", "Brasil", "Mundo", "Inter", "Grêmio"]);
// Baseline V45: sem cache de resposta local.

export default async function (req, res) {
  const rawLimit = Number(req.query?.limit || 60);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 40)) : 60;
  const category = String(req.query?.category || "Todas");

  if (!CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Categoria inválida" });
  }

  // Baseline V45: consulta o banco em cada chamada.

  let sql = "SELECT a.title,a.url,a.summary,a.image_url,a.category,a.published_at,s.name AS source,s.country FROM news_articles a JOIN news_sources s ON s.id=a.source_id ";
  const params = [];

  if (category !== "Todas") {
    sql += "WHERE a.category=$1 ";
    params.push(category);
  }

  sql += "ORDER BY COALESCE(a.published_at,a.fetched_at) DESC LIMIT $" + (params.length + 1);
  params.push(limit);

  const { rows } = await db.query(sql, params);
  // Baseline V45: resposta sem cache HTTP adicional.
  res.json(rows);
}
export const access="public"; export const methods=["GET"];
// Baseline V45: cache local removido.
export default async function(req,res){
 const id=String(req.query?.id||"");if(!id)return res.status(400).json({error:"Informe id da partida"});
 // Baseline V45: consulta a ESPN em cada abertura de partida.
 try{
  const r=await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/summary?event="+encodeURIComponent(id),{headers:{"User-Agent":"VopperNews/1.0"}});
  if(!r.ok)throw new Error("ESPN HTTP "+r.status);const p=await r.json();const c=p?.header?.competitions?.[0],cs=c?.competitors||[];
  const data={source:"ESPN",updatedAt:new Date().toISOString(),header:p?.header||{},competition:c||null,plays:p?.plays||[],leaders:p?.leaders||[],boxscore:p?.boxscore||null,odds:[]};
  res.json(data);
 }catch(e){res.status(502).json({error:"Não foi possível carregar a partida.",detail:String(e?.message||e)})}
}
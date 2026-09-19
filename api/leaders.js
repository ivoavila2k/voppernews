export const access="public"; export const methods=["GET"];
// Baseline V45: cache local removido.
export default async function(req,res){
 // Baseline V45: consulta a ESPN em cada chamada.
 try{
  const r=await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard",{headers:{"User-Agent":"VopperNews/1.0"}});
  if(!r.ok)throw new Error("ESPN HTTP "+r.status);const p=await r.json();
  const events=p?.events||[];const recent=events.filter(e=>e?.status?.type?.state==="post").slice(0,20);
  const goals={};for(const e of recent){for(const pl of e?.competitions?.[0]?.competitors||[]){for(const s of pl?.leaders||[]){const stat=s?.name||"";if(/goal/i.test(stat))for(const a of s?.leaders||[]){const n=a?.athlete?.displayName;if(n)goals[n]=(goals[n]||0)+(Number(a?.value)||0)}}}}
  const data={source:"ESPN",updatedAt:new Date().toISOString(),topScorers:Object.entries(goals).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,goals])=>({name,goals}))};
  res.json(data);
 }catch(e){res.status(502).json({error:"Não foi possível carregar estatísticas.",detail:String(e?.message||e)})}
}
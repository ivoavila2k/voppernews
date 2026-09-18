export const access="public"; export const methods=["GET"];
const cache={at:0,data:null};
export default async function(req,res){
 if(cache.data&&Date.now()-cache.at<900000)return res.json(cache.data);
 try{
  const r=await fetch("https://site.api.espn.com/apis/v2/sports/soccer/bra.1/standings",{headers:{"User-Agent":"VopperNews/1.0"}});
  if(!r.ok)throw new Error("ESPN HTTP "+r.status);
  const p=await r.json();
  const groups=p?.children||[];
  const entries=groups.flatMap(g=>g?.standings?.entries||[]);
  const teams=entries.map((e,i)=>{
   const t=e?.team||{}, stats=Object.fromEntries((e?.stats||[]).map(s=>[s.name,Number(s.value)||0]));
   return {id:t.id||"",name:t.displayName||t.name||"",rank:Number(e?.rank||i+1),points:stats.points||0,games:stats.gamesPlayed||0,wins:stats.wins||0,draws:stats.ties||0,losses:stats.losses||0,goalsFor:stats.pointsFor||0,goalsAgainst:stats.pointsAgainst||0,goalDiff:stats.differential??stats.goalDifference??stats.goalDiff??((stats.pointsFor??0)-(stats.pointsAgainst??0)),form:e?.form||""};
  }).filter(x=>x.name).sort((a,b)=>a.rank-b.rank);
  if(teams.length<15)throw new Error("Classificação incompleta");
  const data={source:"ESPN",updatedAt:new Date().toISOString(),teams};
  cache.at=Date.now();cache.data=data;res.setHeader("Cache-Control","public,max-age=900,stale-while-revalidate=1800");res.json(data);
 }catch(e){res.status(502).json({error:"Não foi possível atualizar a classificação.",detail:String(e?.message||e)})}
}
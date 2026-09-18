export const access="public";
export const methods=["GET"];
const cache=new Map();
function isoDate(d){return d.toISOString().slice(0,10).replaceAll("-","")}
export default async function(req,res){
 const requested=String(req.query?.dates||"");
 const key=requested||"next-14-days"; const hit=cache.get(key);
 if(hit&&Date.now()-hit.at<600000)return res.json(hit.data);
 try{
  let dates=[];
  if(requested) dates=[requested];
  else {
   const now=new Date();
   for(let i=0;i<=14;i++){const d=new Date(now);d.setUTCDate(now.getUTCDate()+i);dates.push(isoDate(d))}
  }
  const urls=dates.map(d=>"https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard?dates="+d);
  const results=await Promise.all(urls.map(async url=>{const r=await fetch(url,{headers:{"User-Agent":"VopperNews/1.0"}});if(!r.ok)throw new Error("ESPN HTTP "+r.status);return r.json()}));
  const raw=results.flatMap(p=>p?.events||[]);
  const seen=new Set(); const events=raw.map(e=>{const c=e?.competitions?.[0],cs=c?.competitors||[],h=cs.find(x=>x.homeAway==="home")||cs[0],a=cs.find(x=>x.homeAway==="away")||cs[1];return{id:e.id,name:e.name,date:e.date,state:e?.status?.type?.state||"pre",status:e?.status?.type?.shortDetail||e?.status?.type?.detail||"",clock:e?.status?.displayClock||"",home:h?.team?.displayName||"",away:a?.team?.displayName||"",homeScore:Number(h?.score||0),awayScore:Number(a?.score||0),venue:c?.venue?.fullName||"",week:e?.week?.number||null}}).filter(e=>{if(!e.id||seen.has(e.id))return false;seen.add(e.id);return true}).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const data={source:"ESPN",updatedAt:new Date().toISOString(),events};cache.set(key,{at:Date.now(),data});res.setHeader("Cache-Control","public,max-age=600,stale-while-revalidate=1200");res.json(data);
 }catch(e){res.status(502).json({error:"Não foi possível atualizar os jogos.",detail:String(e?.message||e)})}
}
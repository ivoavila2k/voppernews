import { db } from "hatchable";
export const access="public";
export const methods=["POST"];
export const schedule="0 * * * *";
let lastManualRefresh=0;
const SOURCES=[
{name:"G1",country:"Brasil",url:"https://g1.globo.com/rss/g1/",category:"Brasil"},
{name:"Agência Brasil",country:"Brasil",url:"https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",category:"Brasil"},
{name:"CNN Brasil",country:"Brasil",url:"https://www.cnnbrasil.com.br/feed/",category:"Brasil"},
{name:"BBC News Brasil",country:"Mundo",url:"https://feeds.bbci.co.uk/portuguese/rss.xml",category:"Mundo"},
{name:"Google News - Mundo",country:"Mundo",url:"https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419",category:"Mundo"},{name:"Google News - Internacional",country:"Brasil",url:"https://news.google.com/rss/search?q=Internacional%20Inter%20Porto%20Alegre%20futebol&hl=pt-BR&gl=BR&ceid=BR:pt-419",category:"Inter"},{name:"Google News - Grêmio",country:"Brasil",url:"https://news.google.com/rss/search?q=Gr%C3%AAmio%20Porto%20Alegre%20futebol&hl=pt-BR&gl=BR&ceid=BR:pt-419",category:"Grêmio"}];
function clean(s=""){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim()}
function tag(b,n){const m=b.match(new RegExp("<"+n+"[^>]*>([\\s\\S]*?)</"+n+">","i"));return m?clean(m[1]):""}
function parse(xml){const out=[];const re=new RegExp("<item>([\\s\\S]*?)</item>","gi");let m;while((m=re.exec(xml))&&out.length<40){const b=m[1],title=tag(b,"title"),url=tag(b,"link")||tag(b,"guid"),summary=tag(b,"description"),pub=tag(b,"pubDate");if(title&&url)out.push({title,url,summary,published_at:pub?new Date(pub).toISOString():null})}return out}
export default async function(req,res){
 if(req.method==="POST" && Date.now()-lastManualRefresh<60_000) return res.status(429).json({ok:false,error:"Atualização já executada. Aguarde alguns segundos."});
 if(req.method==="POST") lastManualRefresh=Date.now();
 let processed=0,errors=[];
 for(const s of SOURCES)try{
  await db.query("INSERT INTO news_sources(name,country,feed_url,category) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET feed_url=EXCLUDED.feed_url,country=EXCLUDED.country,category=EXCLUDED.category",[s.name,s.country,s.url,s.category]);
  const response=await fetch(s.url,{headers:{"user-agent":"RadarNoticias/1.0"}});if(!response.ok)throw new Error("HTTP "+response.status);
  for(const a of parse(await response.text())){const r=await db.query("INSERT INTO news_articles(source_id,title,url,summary,category,published_at) SELECT id,$2,$3,$4,category,$5 FROM news_sources WHERE name=$1 ON CONFLICT(source_id,url) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,published_at=EXCLUDED.published_at,fetched_at=NOW() RETURNING id",[s.name,a.title,a.url,a.summary,a.category,a.published_at]);if(r.rowCount)processed++}
 }catch(e){errors.push(s.name+": "+String(e.message||e))}
 await db.query("DELETE FROM news_articles WHERE fetched_at < NOW() - INTERVAL '14 days'");
 res.json({ok:true,processed,errors,updated_at:new Date().toISOString()});
}
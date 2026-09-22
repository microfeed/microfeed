/** Local workerd CPU sampling and indexed URL operation counts; never contacts a site. */
import {build} from "esbuild";
import {Miniflare} from "miniflare";
import {readFile} from "node:fs/promises";
import {unstable_splitSqlQuery} from "wrangler";

const built = await build({
  stdin: {resolveDir: process.cwd(), contents: `
    import {resolveMetadata} from './src/server/seo/metadata';
    import {prepareItemUrl, resolveItemRoute} from './src/server/items/urls';
    const feed = {title:'Example channel', language:'en', _microfeed:{publisher:{name:'Publisher',type:'Organization'},authors:[{name:'Writer',type:'Person'}]}};
    const item = {title:'学习中文 and multilingual publishing',content_text:'A representative article summary. '.repeat(20),date_published:'2026-09-21T00:00:00Z',_microfeed:{web_url:'https://example.com/i/学习中文/',status:'published',seo:{title:'Custom title',description:'Custom summary',social_image:{url:'https://example.com/social.jpg',width:1200,height:630,mime_type:'image/jpeg',alt:'Example image'}}}};
    const headHtml = '<title>Theme title</title><meta property="og:title" content="Theme title"><meta name="description" content="Theme summary"><style>body {color:black}</style>';
    export default {async fetch(request, env) {
      const url = new URL(request.url);
      if(url.pathname === '/prepare') {
        const statements=[];
        const db={prepare(sql){statements.push(sql);return env.DB.prepare(sql)}};
        const result=await prepareItemUrl(db, await request.json());
        return Response.json({reads:statements.filter(s=>s.startsWith('SELECT')).length,writes:Number(Boolean(result.statement))});
      }
      const large=url.pathname==='/metadata-large';
      const benchmarkFeed=large?{...feed,_microfeed:{...feed._microfeed,authors:Array.from({length:50},(_,n)=>({name:'Author '+n,type:'Person',url:'https://example.com/author/'+n}))}}:feed;
      const benchmarkItem=large?{...item,content_text:'A large article. '.repeat(65000),_microfeed:{...item._microfeed,seo:{title:'T'.repeat(4096),description:'D'.repeat(10000)}}}:item;
      const benchmarkHead=large?headHtml+'<style>'+'.example {color:black}'.repeat(5000)+'</style>':headHtml;
      const count=Number(url.searchParams.get('count')||1);
      for(let n=0;n<count;n++) {
        if(url.pathname==='/route') await resolveItemRoute(env.DB,'学习中文');
        else await resolveMetadata({feed:benchmarkFeed,item:benchmarkItem,origin:'https://example.com',headHtml:benchmarkHead});
      }
      return Response.json({count});
    }};`, loader: "ts"},
  bundle: true, format: "esm", platform: "browser", write: false,
});
const mf = new Miniflare({script: built.outputFiles[0]!.text, modules: true, compatibilityDate: "2026-07-01", inspectorPort: 0, d1Databases: ["DB"]});
let socket: WebSocket | undefined;
try {
  const db = await mf.getD1Database("DB");
  for (const migration of ["0001_initial", "0024_item_urls"]) {
    const sql = await readFile(new URL(`../migrations/${migration}.sql`, import.meta.url), "utf8");
    await db.batch(unstable_splitSqlQuery(sql).map((statement) => db.prepare(statement)));
  }
  await db.prepare("INSERT INTO items(id,status,data,public_path,url_mode) VALUES('benchmark01',1,'{}','/i/学习中文/','custom')").run();
  await db.prepare("INSERT INTO item_paths SELECT '/i/history-' || value || '/', 'benchmark01', 1 FROM json_each(?)")
    .bind(JSON.stringify(Array.from({length:10000}, (_, n) => n))).run();
  const plan = await db.prepare("EXPLAIN QUERY PLAN SELECT item_id FROM item_paths WHERE path IN (?, ?) ORDER BY (path = ?) DESC LIMIT 1")
    .bind("/i/学习中文/", "/i/学习中文/", "/i/学习中文/").all();
  console.log(JSON.stringify({reservations:10002, queryPlan:plan.results}, null, 2));
  for (const [label, item] of Object.entries({
    frozenEdit:{id:"benchmark01",title:"Changed title",status:1},
    create:{id:"newitem0001",title:"New item",status:2},
    rename:{id:"benchmark01",title:"Changed title",status:1,applySlug:"renamed"},
  })) {
    const response = await mf.dispatchFetch("http://localhost/prepare", {method:"POST",body:JSON.stringify(item)});
    console.log(label, await response.text());
  }
  const inspector = await mf.getInspectorURL();
  const discovery = new URL("/json/list", inspector);
  discovery.protocol = "http:";
  const targets = await (await fetch(discovery)).json() as Array<{id:string; webSocketDebuggerUrl:string}>;
  const target = targets.find(({id}) => id.endsWith("core:user")) ?? targets.find(({id}) => id.includes("user"));
  if (!target) throw new Error("Local Worker inspector target is missing.");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve,reject) => {socket!.addEventListener("open",()=>resolve(),{once:true});socket!.addEventListener("error",reject,{once:true});});
  let sequence = 0;
  const send = (method:string,params:Record<string,unknown>={}) => new Promise<any>((resolve,reject) => {
    const id=++sequence;
    const listener=(event:MessageEvent) => {const message=JSON.parse(String(event.data));if(message.id!==id)return;socket!.removeEventListener("message",listener);message.error?reject(new Error(JSON.stringify(message.error))):resolve(message.result);};
    socket!.addEventListener("message",listener);socket!.send(JSON.stringify({id,method,params}));
  });
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval",{interval:100});
  for (const route of ["metadata", "metadata-large", "route"]) {
    await (await mf.dispatchFetch(`http://localhost/${route}?count=100`)).text();
    await send("Profiler.start");
    const count=route === "metadata-large" ? 100 : 1000;
    await (await mf.dispatchFetch(`http://localhost/${route}?count=${count}`)).text();
    const {profile}=await send("Profiler.stop");
    const names=new Map<number,string>(profile.nodes.map((node:any)=>[node.id,node.callFrame.functionName]));
    let activeUs=0;
    for(let n=0;n<profile.samples.length;n++) if(!["(idle)","(root)"].includes(names.get(profile.samples[n])??"")) activeUs+=profile.timeDeltas[n];
    console.log(JSON.stringify({operation:route,iterations:count,estimatedActiveCpuMsPerOperation:activeUs/1000/count,samples:profile.samples.length}));
  }
} finally {
  socket?.close();
  await mf.dispose();
}

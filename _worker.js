const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status,
  headers: {'content-type':'application/json; charset=utf-8', ...headers}
});

const COOKIE = 'case_lab_admin';
const enc = new TextEncoder();

function b64url(bytes){
  let s=''; for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64url(s){
  s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='=';
  const raw=atob(s); return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function hmac(secret, value){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function makeToken(secret, username){
  const payload=b64url(enc.encode(JSON.stringify({u:username,exp:Date.now()+1000*60*60*24*7})));
  return payload+'.'+b64url(await hmac(secret,payload));
}
async function verifyToken(secret, token){
  try{
    const [payload,sig]=token.split('.'); if(!payload||!sig)return null;
    const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const ok=await crypto.subtle.verify('HMAC',key,unb64url(sig),enc.encode(payload)); if(!ok)return null;
    const obj=JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if(!obj.exp || obj.exp<Date.now())return null; return obj;
  }catch(e){return null;}
}
function cookies(request){
  const out={}; for(const part of (request.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());} return out;
}
async function adminUser(request, env){
  if(!env.ADMIN_SECRET)return null;
  return verifyToken(env.ADMIN_SECRET,cookies(request)[COOKIE]||'');
}
function cleanCase(x={}){
  const arr=v=>Array.isArray(v)?v.filter(Boolean):String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
  const bool=v=>v===true||v===1||v==='1'||v==='true';
  return {
    slug:String(x.slug||'').trim().toLowerCase().replace(/\s+/g,'-'),
    title_en:String(x.title_en||'').trim(), title_ar:String(x.title_ar||'').trim(),
    summary_en:String(x.summary_en||''), summary_ar:String(x.summary_ar||''),
    category_en:String(x.category_en||''), category_ar:String(x.category_ar||''),
    difficulty_en:String(x.difficulty_en||'Intermediate'), difficulty_ar:String(x.difficulty_ar||'متوسط'),
    tags:JSON.stringify(arr(x.tags)),
    scenario_en:String(x.scenario_en||''), scenario_ar:String(x.scenario_ar||''),
    mission_en:String(x.mission_en||''), mission_ar:String(x.mission_ar||''),
    data_en:String(x.data_en||''), data_ar:String(x.data_ar||''),
    hints_en:String(x.hints_en||''), hints_ar:String(x.hints_ar||''),
    solution_en:String(x.solution_en||''), solution_ar:String(x.solution_ar||''),
    files:JSON.stringify(arr(x.files)),
    published:bool(x.published)?1:0,
    sort_order:Number.isFinite(Number(x.sort_order))?Number(x.sort_order):0
  };
}
function mapRow(r){
  const parse=v=>{try{return JSON.parse(v||'[]')}catch(e){return[]}};
  return {...r,tags:parse(r.tags),files:parse(r.files),published:!!r.published};
}
async function ensureSeed(env){
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM cases').first();
  if(Number(count?.n||0)>0)return;
  const seed=[
    ['revenue-under-pressure','Revenue Under Pressure','الإيرادات تحت الضغط','Diagnose a revenue slowdown, identify the key drivers, and build a management-ready view.','حلل تباطؤ الإيرادات وحدد المحركات الرئيسية وابنِ رؤية مناسبة للإدارة.','Revenue Analysis','تحليل الإيرادات','Intermediate','متوسط',['Revenue','Drivers','Analysis','FP&A']],
    ['profitability-deep-dive','Profitability Deep Dive','تحليل الربحية بعمق','Sales are growing, but profit is not. Find the real margin drivers.','المبيعات تنمو لكن الأرباح لا تتحرك بنفس الشكل. اكتشف الأسباب.','Profitability','الربحية','Intermediate','متوسط',['Margins','Profitability','Excel']],
    ['build-the-fpa-plan','Build the FP&A Plan','ابنِ خطة FP&A','Build a planning view from assumptions, budgets and forecasts.','ابنِ رؤية تخطيطية من الافتراضات والميزانية والتوقعات.','FP&A','التخطيط المالي','Advanced','متقدم',['FP&A','Budget','Forecast']],
    ['variance-analysis','The Variance Story','قصة الانحرافات','Turn actual-vs-budget variance into a management-ready analysis.','حوّل انحرافات الفعلي مقابل الموازنة إلى تحليل مناسب للإدارة.','Management Reporting','تقارير الإدارة','Beginner','مبتدئ',['Variance','Reporting','Budget']],
    ['forecast-reset','Reset the Forecast','أعد بناء التوقعات','Rebuild the forecast, challenge assumptions and explain the gap.','أعد بناء التوقعات واختبر الافتراضات واشرح الفجوة.','Forecasting','التنبؤ المالي','Advanced','متقدم',['Forecast','Scenario','FP&A']],
    ['business-performance-review','Business Performance Review','مراجعة أداء الأعمال','Create an analyst-style performance review from business data.','أنشئ مراجعة أداء بأسلوب المحلل المالي من بيانات الأعمال.','Business Performance','أداء الأعمال','Intermediate','متوسط',['KPIs','Performance','Analysis']]
  ];
  const stmt=env.DB.prepare(`INSERT OR IGNORE INTO cases
    (slug,title_en,title_ar,summary_en,summary_ar,category_en,category_ar,difficulty_en,difficulty_ar,tags,published,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`);
  await env.DB.batch(seed.map((s,i)=>stmt.bind(...s.slice(0,10),i)));
}

export default {
  async fetch(request, env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try{
      const path=url.pathname;
      if(path==='/api/login' && request.method==='POST'){
        const body=await request.json().catch(()=>({}));
        if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD||!env.ADMIN_SECRET)return json({ok:false,message:'Admin secrets are not configured.'},503);
        if(String(body.username||'')!==env.ADMIN_USERNAME || String(body.password||'')!==env.ADMIN_PASSWORD)return json({ok:false,message:'Invalid username or password.'},401);
        const token=await makeToken(env.ADMIN_SECRET,env.ADMIN_USERNAME);
        return json({ok:true},200,{'set-cookie':`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`});
      }
      if(path==='/api/logout' && request.method==='POST'){
        return json({ok:true},200,{'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
      }
      if(path==='/api/me' && request.method==='GET'){
        const u=await adminUser(request,env); return json({ok:!!u,username:u?.u||null});
      }
      if(path==='/api/cases' && request.method==='GET'){
        const admin=url.searchParams.get('admin')==='1';
        if(admin && !(await adminUser(request,env)))return json({ok:false,message:'Unauthorized'},401);
        await ensureSeed(env);
        const sql=admin?'SELECT * FROM cases ORDER BY sort_order ASC,id ASC':'SELECT * FROM cases WHERE published=1 ORDER BY sort_order ASC,id ASC';
        const {results}=await env.DB.prepare(sql).all();
        return json({ok:true,cases:results.map(mapRow)});
      }
      const match=path.match(/^\/api\/cases\/(\d+)$/);
      if(match){
        if(!(await adminUser(request,env)))return json({ok:false,message:'Unauthorized'},401);
        const id=Number(match[1]);
        if(request.method==='GET'){
          const r=await env.DB.prepare('SELECT * FROM cases WHERE id=?').bind(id).first();
          return r?json({ok:true,case:mapRow(r)}):json({ok:false,message:'Not found'},404);
        }
        if(request.method==='PUT'){
          const body=cleanCase(await request.json());
          if(!body.slug||!body.title_en)return json({ok:false,message:'Title EN and Slug are required.'},400);
          await env.DB.prepare(`UPDATE cases SET slug=?,title_en=?,title_ar=?,summary_en=?,summary_ar=?,category_en=?,category_ar=?,difficulty_en=?,difficulty_ar=?,tags=?,scenario_en=?,scenario_ar=?,mission_en=?,mission_ar=?,data_en=?,data_ar=?,hints_en=?,hints_ar=?,solution_en=?,solution_ar=?,files=?,published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(
            body.slug,body.title_en,body.title_ar,body.summary_en,body.summary_ar,body.category_en,body.category_ar,body.difficulty_en,body.difficulty_ar,body.tags,body.scenario_en,body.scenario_ar,body.mission_en,body.mission_ar,body.data_en,body.data_ar,body.hints_en,body.hints_ar,body.solution_en,body.solution_ar,body.files,body.published,body.sort_order,id).run();
          const r=await env.DB.prepare('SELECT * FROM cases WHERE id=?').bind(id).first(); return json({ok:true,case:mapRow(r)});
        }
        if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM cases WHERE id=?').bind(id).run();return json({ok:true});}
      }
      if(path==='/api/cases' && request.method==='POST'){
        if(!(await adminUser(request,env)))return json({ok:false,message:'Unauthorized'},401);
        const body=cleanCase(await request.json());
        if(!body.slug||!body.title_en)return json({ok:false,message:'Title EN and Slug are required.'},400);
        const r=await env.DB.prepare(`INSERT INTO cases (slug,title_en,title_ar,summary_en,summary_ar,category_en,category_ar,difficulty_en,difficulty_ar,tags,scenario_en,scenario_ar,mission_en,mission_ar,data_en,data_ar,hints_en,hints_ar,solution_en,solution_ar,files,published,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          body.slug,body.title_en,body.title_ar,body.summary_en,body.summary_ar,body.category_en,body.category_ar,body.difficulty_en,body.difficulty_ar,body.tags,body.scenario_en,body.scenario_ar,body.mission_en,body.mission_ar,body.data_en,body.data_ar,body.hints_en,body.hints_ar,body.solution_en,body.solution_ar,body.files,body.published,body.sort_order).run();
        const row=await env.DB.prepare('SELECT * FROM cases WHERE id=?').bind(r.meta.last_row_id).first(); return json({ok:true,case:mapRow(row)},201);
      }
      return json({ok:false,message:'Not found'},404);
    }catch(e){return json({ok:false,message:e?.message||'Server error'},500);}
  }
};

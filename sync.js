/* Sync: each student gets an anonymous Supabase account on their device, gives a first name and a class once,
   and their progress (the same object the page keeps in localStorage) is saved to the database.
   Without a configured database, or offline, the page keeps working on the device only. */
window.Sync=(function(){
const cfg=window.SUPA||{}, ON=!!(cfg.url&&cfg.key&&window.supabase);
const NKEY="massalik-eleve";
let sb=null, uid=null, ready=false, pending=null, timer=null, busy=false;

function summary(P){
  const g=P.g||{}; let words=0;
  Object.entries(P.srs||{}).forEach(([k,a])=>{if(k.startsWith("r|")&&a[0]===2)words++});
  return {reviews:P.reviews||0, xp:g.xp||0, streak:g.streak||0, words, last_at:P.last?new Date(P.last).toISOString():null};
}

/* first visit: ask the student's first name and class (the only personal data stored) */
function askName(){
  return new Promise(res=>{
    const d=document.createElement("div"); d.className="who-modal"; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","whoT");
    d.innerHTML=`<form class="who-box" novalidate>
      <h2 id="whoT">Bienvenue !</h2>
      <p>Indique ton prénom et ta classe pour que ton professeur puisse suivre tes révisions.</p>
      <label for="whoN">Ton prénom</label><input id="whoN" maxlength="40" autocomplete="given-name" required>
      <label for="whoC">Ta classe ou ton groupe</label><input id="whoC" maxlength="30" placeholder="Exemple : A1 samedi">
      <p class="who-err" id="whoE" hidden>Écris ton prénom pour continuer.</p>
      <button class="primary" type="submit">Commencer à réviser</button>
      <small>Seuls ton prénom, ta classe et ta progression sont enregistrés, uniquement pour le suivi par Massalikul'ulum. Tu peux demander leur suppression à ton professeur.</small>
    </form>`;
    document.body.appendChild(d);
    const f=d.querySelector("form"), n=d.querySelector("#whoN"), e=d.querySelector("#whoE");
    n.focus(); n.oninput=()=>{e.hidden=true};
    f.onsubmit=ev=>{ev.preventDefault(); const name=n.value.trim(); if(!name){e.hidden=false;n.focus();return}
      d.remove(); res({first_name:name, class_code:d.querySelector("#whoC").value.trim()||null})};
  });
}

async function init(onRemote){
  if(!ON) return false;
  try{
    /* the student page keeps its own session, apart from the teacher dashboard on the same site */
    sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"massalik-eleve-auth"}});
    const fresh=async()=>{const r=await sb.auth.signInAnonymously(); if(r.error) throw r.error; return r.data.session};
    let {data:{session}}=await sb.auth.getSession();
    if(!session) session=await fresh();
    let q=await sb.from("students").select("first_name,class_code").eq("id",session.user.id).maybeSingle();
    /* a session whose account no longer exists (deleted by the teacher): start a new anonymous one */
    if(q.error){ await sb.auth.signOut({scope:"local"}); session=await fresh(); q=await sb.from("students").select("first_name,class_code").eq("id",session.user.id).maybeSingle(); if(q.error) throw q.error }
    uid=session.user.id;
    let me=q.data;
    if(!me){
      let who=null; try{who=JSON.parse(localStorage.getItem(NKEY)||"null")}catch(e){}
      if(!who) who=await askName();
      const r=await sb.from("students").insert({id:uid,...who}); if(r.error) throw r.error;
      try{localStorage.setItem(NKEY,JSON.stringify(who))}catch(e){}
      me=who;
    }
    const {data:row}=await sb.from("progress").select("data").eq("student_id",uid).maybeSingle();
    ready=true;
    if(row&&row.data) onRemote(row.data);
    if(pending) flush();
    return me;
  }catch(err){ console.warn("Sync désactivée :",err&&err.message||err); ready=false; return false }
}
function save(P){ if(!ON) return; pending=P; clearTimeout(timer); timer=setTimeout(flush,1500) }
async function flush(){
  if(!ready||busy||!pending) return; busy=true; const P=pending; pending=null;
  const r=await sb.from("progress").upsert({student_id:uid, data:P, ...summary(P), updated_at:new Date().toISOString()});
  busy=false;
  if(r.error){pending=pending||P; timer=setTimeout(flush,8000)}
  else if(pending){timer=setTimeout(flush,1500)}
  if(window.Sync.onStatus) window.Sync.onStatus(r.error?"retry":"ok");
}
addEventListener("pagehide",()=>{if(pending)flush()});
return {on:ON, init, save, onStatus:null};
})();

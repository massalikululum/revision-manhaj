/* Quiz chrono + défi du jour — lives in #quizApp, talks to window.App (page) and window.Gami (points, badges) */
window.Quiz=(function(){
const {units:UNITS, cards:CARDS} = window.DATA, EM = window.EMOJI || {};
const CHAPTERS=[1,2,3], DURATION=90, DEFI_N=10, RKEY="manhaj-quiz-records-90";
const root=document.getElementById("quizApp"), $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm=s=>s.replace(/[ً-ٰٟ]/g,"");
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};

let records={}; try{records=JSON.parse(localStorage.getItem(RKEY)||"{}")}catch(e){}
const saveRec=()=>{try{localStorage.setItem(RKEY,JSON.stringify(records))}catch(e){}};
let pick="all", level="easy", game=null, tick=null;
try{const l=localStorage.getItem(RKEY+"-level"); if(l==="easy"||l==="normal") level=l}catch(e){}
const recKey=()=>level+"|"+pick;

/* words (mufradat) and expressions (tarakib), deduplicated across the chosen chapters */
function pool(sel){const ids=new Set();UNITS.filter(u=>sel==="all"?CHAPTERS.includes(u.id):u.id===sel).forEach(u=>[...u.w,...u.t].forEach(id=>ids.add(id)));return [...ids]}
/* distractors for the daily challenge come from the chapters its cards belong to */
function poolAround(ids){const set=new Set();UNITS.forEach(u=>{const all=[...u.w,...u.t];if(all.some(x=>ids.includes(x)))all.forEach(x=>set.add(x))});return [...set]}

const img=(slug,cls)=>EM[slug]?`<img class="${cls}" src="${EM[slug]}" alt="">`:"";
const fillGap=(t,reveal)=>esc(t).replace(/\[(.+?)\]/g,(_,w)=>reveal?`<mark>${w}</mark>`:`<span class="gap" aria-label="mot manquant"></span>`);
const sentence=(c,reveal)=>c.k==="t"?c.s.split(" / ").map(l=>`<span class="line">— ${fillGap(l,reveal)}</span>`).join(""):fillGap(c.s,reveal);

function stop(){clearInterval(tick); game=null}
function home(){
  stop();
  const d=window.Gami?Gami.defiState():{done:true,ids:[]};
  const chip=(key,n,ar)=>{const r=records[level+"|"+key];return `<button class="unit" data-k="${key}" aria-pressed="${pick===key}"><span class="n">${n}</span><span class="ar" lang="ar">${ar}</span><span class="due ${r?"rec":""}">${r?"Record : "+r:"Pas encore joué"}</span></button>`};
  root.innerHTML=`
    <div class="defi ${d.done?"done":""}">
      <div><b><svg class="ico" viewBox="0 0 18 18" aria-hidden="true" style="vertical-align:-3px;margin-inline-end:6px"><circle cx="9" cy="9" r="3.5"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4"/></svg>Défi du jour</b><span>${d.done?"Relevé ! Reviens demain pour le prochain.":d.ids.length>=4?`${DEFI_N} questions sur les mots qui te résistent · points ×2`:"Révise quelques cartes pour débloquer ton premier défi."}</span></div>
      ${!d.done&&d.ids.length>=4?'<button class="primary" id="defi">Relever</button>':""}
    </div>
    <div class="panel home">
    <div class="levels" role="group" aria-label="Niveau">
      <button class="lvl" data-l="easy" aria-pressed="${level==="easy"}"><b>Facile</b><span>Lis le mot, choisis l'image</span></button>
      <button class="lvl" data-l="normal" aria-pressed="${level==="normal"}"><b>Normal</b><span>Regarde l'image, choisis le mot</span></button>
    </div>
    <div class="pickLbl">Chapitre</div>
    <div class="shelf">${chip("all","Les 3 chapitres","١ ، ٢ ، ٣")}${CHAPTERS.map(id=>{const u=UNITS.find(x=>x.id===id);return chip(id,"Chapitre "+id,u.ar)}).join("")}</div>
    <button class="primary" id="go">Commencer · 90 s</button>
    <details class="rules"><summary>Règles du quiz</summary><p>+1 point par bonne réponse, ×2 après 5 d'affilée. Les erreurs reviennent un peu plus tard dans la partie.</p></details></div>`;
  $$(".unit").forEach(b=>b.onclick=()=>{pick=b.dataset.k==="all"?"all":+b.dataset.k;home()});
  const sel=$('.unit[aria-pressed="true"]'), strip=$(".shelf"); if(sel&&strip) strip.scrollLeft=sel.offsetLeft-strip.offsetLeft-8;
  $$(".lvl").forEach(b=>b.onclick=()=>{level=b.dataset.l;try{localStorage.setItem(RKEY+"-level",level)}catch(e){};home()});
  $("#go").onclick=()=>start(false);
  const df=$("#defi"); if(df) df.onclick=()=>start(true);
}

const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
function start(defi){
  stop();
  let n=3;
  const show=()=>{root.innerHTML=`<div class="panel count" aria-live="assertive">${n?`<span class="num">${n}</span>`:`<span class="num go" lang="ar">اِبْدَأْ!</span>`}<span class="sub">${defi?"Défi du jour · ":""}${level==="easy"?"Lis le mot, choisis l'image":"Regarde l'image, choisis le mot"}</span></div>`};
  show();
  tick=setInterval(()=>{n--; if(n>=0) show(); if(n<0){clearInterval(tick);begin(defi)}}, reduced?600:800);
}
function begin(defi){
  const ids=defi?Gami.defiState().ids.slice(0,DEFI_N):pool(pick);
  game={defi, ids, pool:defi?poolAround(ids):ids, queue:shuffle([...ids]), retry:[], score:0, streak:0, best:0, right:0, wrong:0, asked:0,
        missed:new Set(), left:DURATION, end:Date.now()+DURATION*1000, cur:null, locked:false, n:0};
  next();
  if(!defi) tick=setInterval(()=>{game.left=Math.max(0,Math.ceil((game.end-Date.now())/1000));hud();if(game.left<=0)finish()},250);
}
function nextId(){
  game.n++;
  const due=game.retry.findIndex(r=>r.at<=game.n);
  if(due>=0) return game.retry.splice(due,1)[0].id;
  if(!game.queue.length) game.queue=shuffle(game.ids.filter(id=>id!==game.cur));
  return game.queue.shift();
}
function options(id){
  const c=CARDS[id], others=game.pool.filter(x=>x!==id&&norm(CARDS[x].ar)!==norm(c.ar));
  const same=shuffle(others.filter(x=>CARDS[x].ty===c.ty)), rest=shuffle(others.filter(x=>CARDS[x].ty!==c.ty));
  /* no two options may share a main picture, or the easy level becomes ambiguous */
  const used=new Set([c.em[0]]), out=[id];
  for(const x of [...same,...rest]){ if(out.length===4) break; if(used.has(CARDS[x].em[0])) continue; used.add(CARDS[x].em[0]); out.push(x) }
  return shuffle(out);
}
function next(){
  game.cur=nextId(); game.locked=false;
  const c=CARDS[game.cur], opts=options(game.cur); game.opts=opts;
  const pic=x=>`<span class="pic">${img(x.em[0],"m")}${x.em[1]?img(x.em[1],"s"):""}</span>`;
  const body=level==="easy"
    ? `<div class="q in"><div class="word ${c.k==="t"?"t":""}" lang="ar">${esc(c.ar)}</div>
       <div class="choices pics">${opts.map((id,i)=>`<button class="choice img" data-id="${esc(id)}" aria-label="Image ${i+1}"><span class="k">${i+1}</span>${pic(CARDS[id])}</button>`).join("")}</div>
       <div class="sent" lang="ar" id="sent" hidden>${sentence(c,true)}</div></div>`
    : `<div class="q in"><div class="pic" aria-hidden="true">${img(c.em[0],"m")}${c.em[1]?img(c.em[1],"s"):""}</div>
       <div class="sent" lang="ar" id="sent">${sentence(c,false)}</div>
       <div class="choices">${opts.map((id,i)=>`<button class="choice ${CARDS[id].k==="t"?"t":""}" data-id="${esc(id)}" lang="ar"><span class="k">${i+1}</span>${esc(CARDS[id].ar)}</button>`).join("")}</div></div>`;
  root.innerHTML=`<div class="panel" id="play">
    <div class="hud"><span class="time" id="time"></span><span class="track"><i id="bar"></i></span><span class="score" id="score"></span></div>
    <div class="streak" id="streak"></div>
    ${body}
    <div class="keys">Clavier : touches 1 à 4</div></div>`;
  $$(".choice").forEach(b=>b.onclick=()=>answer(b.dataset.id));
  hud();
}
function hud(){
  if(!game||!$("#time")) return;
  if(game.defi){
    $("#time").textContent=`${Math.min(game.asked+1,DEFI_N)}/${DEFI_N}`;
    $("#bar").style.width=(game.asked/DEFI_N*100)+"%";
  } else {
    const low=game.left<=10;
    $("#time").textContent=game.left; $("#time").classList.toggle("low",low);
    $("#bar").style.width=(game.left/DURATION*100)+"%"; $("#bar").classList.toggle("low",low);
  }
  $("#score").innerHTML=`${game.score}<small>points</small>`;
  $("#streak").textContent=game.streak>=5?`Série de ${game.streak} : ×2 !`:game.streak>=2?`Série de ${game.streak}`:"";
}
function answer(id){
  if(game.locked||game.left<=0) return; game.locked=true;
  const ok=id===game.cur, c=CARDS[game.cur];
  $$(".choice").forEach(b=>{b.disabled=true;if(b.dataset.id===game.cur)b.classList.add("ok");else if(b.dataset.id===id)b.classList.add("ko")});
  $("#sent").innerHTML=sentence(c,true); $("#sent").hidden=false;
  if(ok){game.streak++;game.right++;game.score+=game.streak>=5?2:1;game.best=Math.max(game.best,game.streak)}
  else{game.streak=0;game.wrong++;game.missed.add(game.cur);if(!game.defi)game.retry.push({id:game.cur,at:game.n+3})}
  game.asked++;
  if(window.Gami) Gami.onQuizAnswer(ok,(game.streak>=5?2:1)*(game.defi?2:1));
  hud();
  const last=game.defi&&game.asked>=DEFI_N;
  setTimeout(()=>{if(!game)return; if(last)finish(); else if(game.left>0)next()},ok?450:1300);
}
function finish(){
  clearInterval(tick); if(!game||game.done) return; game.done=true;
  const defi=game.defi, key=recKey(), old=defi?0:(records[key]||0), isRec=!defi&&game.score>old&&game.score>0;
  if(isRec){records[key]=game.score;saveRec()}
  if(window.Gami) Gami.onQuizEnd({score:game.score,right:game.right,wrong:game.wrong,best:game.best,defi});
  const miss=[...game.missed];
  root.innerHTML=`<div class="panel">
    ${defi?`<div class="newrec" lang="ar">أَحْسَنْتَ!</div><p class="sub">Défi du jour relevé · points doublés</p>`:isRec?`<div class="newrec" lang="ar">رَقْمٌ قِيَاسِيٌّ جَدِيدٌ!</div>`:""}
    <div class="big">${game.score}</div><div class="sub">points${old&&!isRec?` · ton record : ${old}`:""}</div>
    <div class="stats"><div><b>${game.right}</b><span>bonnes réponses</span></div><div><b>${game.wrong}</b><span>erreurs</span></div><div><b>${game.best}</b><span>meilleure série</span></div></div>
    ${miss.length?`<h2>À revoir</h2><div class="missed">${miss.map(id=>{const c=CARDS[id];return `<div class="miss">${img(c.em[0],"")}<span class="ar" lang="ar">${esc(c.ar)}</span></div>`}).join("")}</div>`:`<p class="sub">Aucune erreur, bravo !</p>`}
    ${miss.length&&!defi?`<button class="ghost review" id="review">Revoir ces mots dans les flashcards →</button>`:""}
    <div class="row">${defi?"":'<button class="primary" id="again">Rejouer</button>'}<button class="ghost" id="back">${defi?"Retour aux jeux":"Changer de chapitre"}</button></div></div>`;
  const ag=$("#again"); if(ag) ag.onclick=()=>start(false);
  $("#back").onclick=home;
  const rv=$("#review"); if(rv) rv.onclick=()=>App.goStudy(pick==="all"?CHAPTERS[0]:pick);
}
document.addEventListener("keydown",e=>{
  if(root.hidden||!game||game.done||!/^[1-4]$/.test(e.key)) return;
  const id=game.opts&&game.opts[+e.key-1]; if(id){e.preventDefault();answer(id)}
});
return {home, stop, setPick:n=>{if(CHAPTERS.includes(n))pick=n}};
})();

/* Gamification: points, levels, daily goal + streak (one joker a week), chapter path, badges, daily challenge.
   State lives in the student's progress (App.getP().g), so it is saved with the flashcards progress. */
window.Gami=(function(){
const {units:UNITS, cards:CARDS} = window.DATA;
const GOAL=20;
const LEVELS=[[1,"مُبْتَدِئٌ"],[3,"طَالِبٌ"],[6,"مُجْتَهِدٌ"],[10,"مُتَمَكِّنٌ"],[15,"عَالِمٌ"]];
const BADGES=[
  ["first","🌱","Premier pas","Première carte révisée",s=>s.reviews>=1],
  ["rev100","📚","Assidu","100 révisions",s=>s.reviews>=100],
  ["rev500","🏛","Infatigable","500 révisions",s=>s.reviews>=500],
  ["w25","✨","25 mots","25 mots acquis",s=>s.words>=25],
  ["w100","💎","100 mots","100 mots acquis",s=>s.words>=100],
  ["w200","👑","200 mots","200 mots acquis",s=>s.words>=200],
  ["s3","🔥","3 jours","3 jours d'affilée",s=>s.streak>=3],
  ["s7","🔥","Une semaine","7 jours d'affilée",s=>s.streak>=7],
  ["s30","🌙","Un mois","30 jours d'affilée",s=>s.streak>=30],
  ["c1","⭐","Premier chapitre","1 chapitre maîtrisé",s=>s.chapters>=1],
  ["c6","🌟","Mi-parcours","6 chapitres maîtrisés",s=>s.chapters>=6],
  ["c12","🏆","Livre terminé","12 chapitres maîtrisés",s=>s.chapters>=12],
  ["qperfect","🎯","Sans faute","Quiz d'au moins 10 bonnes réponses sans erreur",s=>!!s.g.qperfect],
  ["qserie","⚡","Série de 15","15 bonnes réponses d'affilée au quiz",s=>(s.g.qbest||0)>=15],
  ["d1","☀","Premier défi","Premier défi du jour relevé",s=>(s.g.defis||0)>=1],
  ["d7","🌞","7 défis","7 défis du jour relevés",s=>(s.g.defis||0)>=7],
  ["lv5","🎓","Niveau 5","Atteindre le niveau 5",s=>s.level>=5],
  ["lv10","🎓","Niveau 10","Atteindre le niveau 10",s=>s.level>=10],
];
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* local calendar days, so "today" matches the student's clock */
const dayKey=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const shift=n=>{const d=new Date();d.setDate(d.getDate()+n);return dayKey(d)};
const weekKey=()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return dayKey(d)};

function G(){const P=App.getP(); if(!P.g) P.g={xp:0,day:"",today:0,streak:0,lastGoal:"",joker:"",badges:{},defi:"",defis:0}; const g=P.g;
  if(g.day!==dayKey()){g.day=dayKey();g.today=0} return g}
const levelOf=xp=>{let n=1;while(50*n*(n+1)<=xp)n++;return n};          /* level n starts at 50·(n-1)·n XP */
const floorXp=n=>50*(n-1)*n;
const title=n=>{let t=LEVELS[0][1];LEVELS.forEach(([m,a])=>{if(n>=m)t=a});return t};
/* streak shown today: alive if the goal was met today or yesterday, or the day before with this week's joker still unused */
function liveStreak(g){
  if(g.lastGoal===dayKey()||g.lastGoal===shift(-1)) return g.streak;
  if(g.lastGoal===shift(-2)&&g.joker!==weekKey()) return g.streak;
  return 0;
}
function stats(){
  const P=App.getP(), g=G(); let words=0;
  Object.entries(P.srs||{}).forEach(([k,a])=>{if(k.startsWith("r|")&&a[0]===2)words++});
  const chapters=UNITS.filter(u=>{const c=App.counts(u.id);return c.total&&c.ok/c.total>=.8}).length;
  return {g, reviews:P.reviews||0, words, chapters, streak:liveStreak(g), level:levelOf(g.xp)};
}

/* ---- events ---- */
function gain(xp,count){
  const g=G(), before=levelOf(g.xp);
  g.xp+=xp; if(count){g.today+=count; if(g.today>=GOAL&&g.today-count<GOAL) goalReached(g)}
  const after=levelOf(g.xp);
  if(after>before) toast("🎓",`Niveau ${after} · <span lang="ar">${title(after)}</span>`);
  checkBadges(); App.persist(); bar();
}
function goalReached(g){
  const t=dayKey();
  if(g.lastGoal===t) return;
  if(g.lastGoal===shift(-1)) g.streak++;
  else if(g.lastGoal===shift(-2)&&g.joker!==weekKey()){g.streak++;g.joker=weekKey();toast("🛡","Joker utilisé : ta série continue")}
  else g.streak=1;
  g.lastGoal=t;
  toast("🔥",`Objectif du jour atteint · ${g.streak} jour${g.streak>1?"s":""} d'affilée`);
}
function checkBadges(){
  const s=stats();
  BADGES.forEach(([id,ic,name,,test])=>{if(!s.g.badges[id]&&test(s)){s.g.badges[id]=dayKey();toast(ic,"Badge débloqué : "+esc(name))}});
}
const onReview=knew=>gain(knew?10:4,1);
const onQuizAnswer=(ok,mult)=>{if(ok)gain(5*mult,1)};
function onQuizEnd(r){
  const g=G();
  g.qbest=Math.max(g.qbest||0,r.best);
  if(r.right>=10&&r.wrong===0) g.qperfect=1;
  if(r.defi){g.defi=dayKey();g.defis=(g.defis||0)+1;gain(30,0)} else {checkBadges();App.persist();bar()}
}

/* daily challenge: the 10 cards the student struggles with most (lapses, then still being learned) */
function defiState(){
  const g=G(), P=App.getP(), score={};
  Object.entries(P.srs||{}).forEach(([k,a])=>{const id=k.slice(2);if(!CARDS[id])return;score[id]=(score[id]||0)+a[4]*3+(a[0]===1||a[0]===3?2:0)+(a[0]===2?0:1)});
  const ids=Object.keys(score).sort((a,b)=>score[b]-score[a]).slice(0,10);
  return {done:g.defi===dayKey(), ids};
}

/* ---- UI ---- */
function bar(){
  const el=$("#gbar"); if(!el) return;
  const s=stats(), g=s.g, n=s.level, lo=floorXp(n), hi=floorXp(n+1), pct=Math.round((g.xp-lo)/(hi-lo)*100), gp=Math.min(1,g.today/GOAL);
  el.innerHTML=`<button class="gchip streak ${s.streak?"on":""}" data-go="progress" title="Jours d'affilée">🔥 <b>${s.streak}</b></button>
    <button class="gchip lvl" data-go="progress" title="Ton niveau"><b>Niv. ${n}</b> <span lang="ar">${title(n)}</span><i class="xp"><i style="width:${pct}%"></i></i></button>
    <button class="gchip goal" data-go="progress" title="Objectif du jour : ${GOAL} révisions"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="r0"/><circle cx="18" cy="18" r="15" class="r1" style="stroke-dasharray:${Math.round(gp*94.2)} 94.2"/></svg><span>${Math.min(g.today,GOAL)}/${GOAL}</span></button>`;
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>App.setView("progress"));
}
function renderProgress(el){
  const s=stats(), g=s.g, n=s.level, lo=floorXp(n), hi=floorXp(n+1);
  const path=UNITS.map((u,i)=>{const c=App.counts(u.id), p=c.total?Math.round(c.ok/c.total*100):0, st=p>=80?"done":p>0?"part":"todo";
    return `<li class="${st} ${i%2?"r":"l"}"><button class="node" data-u="${u.id}" style="--p:${p}"><span class="num">${p>=80?"★":u.id}</span></button>
      <div class="lbl"><b>Chapitre ${u.id}</b><span lang="ar">${u.ar}</span><small>${p} % maîtrisé</small></div></li>`}).join("");
  const badges=BADGES.map(([id,ic,name,desc])=>{const got=g.badges[id];return `<li class="${got?"got":"lock"}" title="${esc(desc)}"><span class="ic">${got?ic:"🔒"}</span><b>${esc(name)}</b><small>${esc(desc)}</small></li>`}).join("");
  const nb=Object.keys(g.badges).length;
  el.innerHTML=`<div class="prog">
    <div class="pcard lvlcard"><div class="big" lang="ar">${title(n)}</div><div>Niveau <b>${n}</b> · ${g.xp} points</div>
      <span class="xp big"><i style="width:${Math.round((g.xp-lo)/(hi-lo)*100)}%"></i></span><small>Encore ${hi-g.xp} points pour le niveau ${n+1}</small></div>
    <div class="pgrid">
      <div class="pcard"><b class="k">🔥 ${s.streak}</b><div><span>jour${s.streak>1?"s":""} d'affilée</span><small>${g.joker===weekKey()?"Joker utilisé cette semaine":"1 joker cette semaine"}</small></div></div>
      <div class="pcard"><b class="k">${Math.min(g.today,GOAL)}/${GOAL}</b><div><span>révisions aujourd'hui</span><small>${g.today>=GOAL?"Objectif atteint ✓":"Cartes et quiz comptent"}</small></div></div>
      <div class="pcard"><b class="k">${s.words}</b><div><span>mots acquis</span><small>sur ${Object.keys(CARDS).length}</small></div></div>
    </div>
    <h2>Ton parcours</h2>
    <p class="note">Un chapitre devient doré quand tu en maîtrises 80 %. Touche un chapitre pour le réviser.</p>
    <ol class="path">${path}</ol>
    <h2>Badges · ${nb}/${BADGES.length}</h2>
    <ul class="badges">${badges}</ul></div>`;
  el.querySelectorAll(".node").forEach(b=>b.onclick=()=>App.goStudy(+b.dataset.u));
}
let tq=[], showing=false;
function toast(ic,html){tq.push([ic,html]); if(!showing) pop()}
function pop(){
  const t=tq.shift(); if(!t){showing=false;return} showing=true;
  const el=document.createElement("div"); el.className="toast"; el.setAttribute("role","status");
  el.innerHTML=`<span class="ic">${t[0]}</span><span>${t[1]}</span>`; document.body.appendChild(el);
  setTimeout(()=>{el.classList.add("out");setTimeout(()=>{el.remove();pop()},300)},2600);
}
return {onReview,onQuizAnswer,onQuizEnd,defiState,bar,renderProgress,checkBadges};
})();

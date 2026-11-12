/* Gamification: points, levels, daily goal + streak (one joker a week), chapter path, ribbon medals, daily challenge.
   State lives in the student's progress (App.getP().g), so it is saved with the flashcards progress. */
window.Gami=(function(){
const {units:UNITS, cards:CARDS} = window.DATA;
const GOAL=20;
const LEVELS=[[1,"مُبْتَدِئٌ"],[3,"طَالِبٌ"],[6,"مُجْتَهِدٌ"],[10,"مُتَمَكِّنٌ"],[15,"عَالِمٌ"]];
/* [id, number on the medal, Arabic name, short French label, how to earn it, test] */
const MEDALS=[
  ["first",1,"وِسَامُ البِدَايَةِ","Premier pas","Première carte révisée",s=>s.reviews>=1],
  ["s3",3,"وِسَامُ المُوَاظَبَةِ","3 jours","3 jours d'affilée",s=>s.streak>=3],
  ["s7",7,"وِسَامُ المُثَابَرَةِ","7 jours","7 jours d'affilée",s=>s.streak>=7],
  ["s30",30,"وِسَامُ الشَّهْرِ","30 jours","30 jours d'affilée",s=>s.streak>=30],
  ["w25",25,"وِسَامُ الكَلِمَاتِ","25 mots","25 mots acquis",s=>s.words>=25],
  ["w100",100,"وِسَامُ المِئَةِ","100 mots","100 mots acquis",s=>s.words>=100],
  ["w200",200,"وِسَامُ الحَافِظِ","200 mots","200 mots acquis",s=>s.words>=200],
  ["rev100",100,"وِسَامُ الاجْتِهَادِ","100 révisions","100 révisions",s=>s.reviews>=100],
  ["rev500",500,"وِسَامُ الهِمَّةِ","500 révisions","500 révisions",s=>s.reviews>=500],
  ["c1",1,"وِسَامُ الفَصْلِ","1 chapitre","1 chapitre maîtrisé",s=>s.chapters>=1],
  ["c6",6,"وِسَامُ نِصْفِ الطَّرِيقِ","6 chapitres","6 chapitres maîtrisés",s=>s.chapters>=6],
  ["c12",12,"وِسَامُ الكِتَابِ","Livre terminé","12 chapitres maîtrisés",s=>s.chapters>=12],
  ["qperfect",10,"وِسَامُ الإِتْقَانِ","Sans faute","Quiz d'au moins 10 bonnes réponses sans erreur",s=>!!s.g.qperfect],
  ["qserie",15,"وِسَامُ السُّرْعَةِ","Série de 15","15 bonnes réponses d'affilée au quiz",s=>(s.g.qbest||0)>=15],
  ["d1",1,"وِسَامُ التَّحَدِّي","1er défi","Premier défi du jour relevé",s=>(s.g.defis||0)>=1],
  ["d7",7,"وِسَامُ التَّحَدِّيَاتِ","7 défis","7 défis du jour relevés",s=>(s.g.defis||0)>=7],
  ["lv5",5,"وِسَامُ المُسْتَوَى","Niveau 5","Atteindre le niveau 5",s=>s.level>=5],
  ["lv10",10,"وِسَامُ المُسْتَوَى","Niveau 10","Atteindre le niveau 10",s=>s.level>=10],
];
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const arNum=n=>String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[d]);

/* line icons drawn in the house style (no emoji) */
const ICON={
  lantern:'<svg class="ico" viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1v3M6 4h8l2 4v8l-2 3H6l-2-3V8z"/><path d="M10 9c1.6 1.5 2 2.8 2 3.8a2 2 0 0 1-4 0c0-1 .4-2.3 2-3.8z"/></svg>',
  shield:'<svg class="ico" viewBox="0 0 20 22" aria-hidden="true"><path d="M10 2l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V5z"/></svg>',
  check:'<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.3l2.4 2.4 4.6-5"/></svg>'
};
/* ribbon medal: gold disc and navy/burgundy ribbon when won, muted grey when still to win */
function medal(num,won,size){
  const disc=won?"#C9A86C":"var(--lock-disc)", a=won?"#1F3A6B":"var(--lock-rib-a)", b=won?"#7A2E2E":"var(--lock-rib-b)";
  const t=arNum(num), big=t.length>2;
  return `<svg class="medal" width="${size}" height="${Math.round(size*130/110)}" viewBox="0 0 110 130" aria-hidden="true">
    <path d="M30 4h22l10 40H48z" fill="${a}"/><path d="M58 4h22L68 44h-14z" fill="${b}"/>
    <circle cx="55" cy="82" r="38" fill="${disc}"/><circle cx="55" cy="82" r="31" fill="none" stroke="#0D0F2B" stroke-width="1.5" opacity=".4"/>
    <text x="55" y="${big?92:97}" text-anchor="middle" font-family="Noto Naskh Arabic, serif" font-weight="700" font-size="${big?26:40}" fill="#0D0F2B">${t}</text></svg>`;
}

/* local calendar days, so "today" matches the student's clock */
const dayKey=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const shift=n=>{const d=new Date();d.setDate(d.getDate()+n);return dayKey(d)};
const weekKey=()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return dayKey(d)};

function G(){const P=App.getP(); if(!P.g) P.g={xp:0,day:"",today:0,streak:0,lastGoal:"",joker:"",badges:{},defi:"",defis:0}; const g=P.g;
  if(g.day!==dayKey()){g.day=dayKey();g.today=0} return g}
const levelOf=xp=>{let n=1;while(50*n*(n+1)<=xp)n++;return n};          /* level n starts at 50·(n-1)·n XP */
const floorXp=n=>50*(n-1)*n;
const title=n=>{let t=LEVELS[0][1];LEVELS.forEach(([m,a])=>{if(n>=m)t=a});return t};
const nextTitle=n=>{const x=LEVELS.find(([m])=>m>n);return x?x[1]:null};
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
  if(after>before) toast(medal(after,true,30),`Niveau ${after} · <span lang="ar">${title(after)}</span>`);
  checkBadges(); App.persist(); bar();
}
function goalReached(g){
  const t=dayKey();
  if(g.lastGoal===t) return;
  if(g.lastGoal===shift(-1)) g.streak++;
  else if(g.lastGoal===shift(-2)&&g.joker!==weekKey()){g.streak++;g.joker=weekKey();toast(ICON.shield,"Joker utilisé : ta série continue")}
  else g.streak=1;
  g.lastGoal=t;
  toast(ICON.lantern,`<span lang="ar">بَارَكَ اللّٰهُ فِيكَ</span> · objectif du jour atteint, ${g.streak} jour${g.streak>1?"s":""} d'affilée`);
}
function checkBadges(){
  const s=stats();
  MEDALS.forEach(([id,num,ar,,,test])=>{if(!s.g.badges[id]&&test(s)){s.g.badges[id]=dayKey();toast(medal(num,true,30),`Nouvelle médaille : <span lang="ar">${ar}</span>`)}});
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
  el.innerHTML=`<button class="gchip streak ${s.streak?"on":""}" data-go="progress" title="Jours d'affilée">${ICON.lantern}<b>${s.streak}</b><span class="lbl"> jour${s.streak>1?"s":""}</span></button>
    <button class="gchip lvl" data-go="progress" title="Ton niveau"><b>Niv. ${n}</b> <span lang="ar">${title(n)}</span><i class="xp"><i style="width:${pct}%"></i></i></button>
    <button class="gchip goal" data-go="progress" title="Objectif du jour : ${GOAL} révisions"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="r0"/><circle cx="18" cy="18" r="15" class="r1" style="stroke-dasharray:${Math.round(gp*94.2)} 94.2"/></svg><span>${Math.min(g.today,GOAL)}/${GOAL}</span></button>`;
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>App.setView("progress"));
}
function renderProgress(el){
  const s=stats(), g=s.g, n=s.level, lo=floorXp(n), hi=floorXp(n+1), nt=nextTitle(n);
  const path=UNITS.map((u,i)=>{const c=App.counts(u.id), p=c.total?Math.round(c.ok/c.total*100):0, st=p>=80?"done":p>0?"part":"todo";
    return `<li class="${st} ${i%2?"r":"l"}"><button class="node" data-u="${u.id}" style="--p:${p}"><span class="num">${p>=80?"✓":u.id}</span></button>
      <div class="lbl"><b>Chapitre ${u.id}</b><span lang="ar">${u.ar}</span><small>${p} % maîtrisé</small></div></li>`}).join("");
  const won=MEDALS.filter(m=>g.badges[m[0]]).length;
  const medals=MEDALS.map(([id,num,ar,fr,desc])=>{const got=!!g.badges[id];
    return `<li class="${got?"got":"lock"}" title="${esc(desc)}">${medal(num,got,62)}<span class="ar" lang="ar">${ar}</span><small>${esc(fr)}</small></li>`}).join("");
  el.innerHTML=`<div class="prog">
    <h1 class="ptitle">Ton parcours</h1>
    <section class="lvlband" aria-label="Niveau"><span class="k">Niveau ${n}</span><span class="big" lang="ar">${title(n)}</span>
      <span class="xp big"><i style="width:${Math.round((g.xp-lo)/(hi-lo)*100)}%"></i></span>
      <small>${g.xp} points · encore ${hi-g.xp} pour le niveau ${n+1}${nt&&LEVELS.find(([m])=>m===n+1)?` (<span lang="ar">${nt}</span>)`:""}</small></section>
    <div class="trio">
      <div><b>${s.streak}</b><span>jour${s.streak>1?"s":""} d'affilée</span><small>${g.joker===weekKey()?"joker utilisé":"1 joker cette semaine"}</small></div>
      <div><b>${Math.min(g.today,GOAL)}/${GOAL}</b><span>aujourd'hui</span><small>${g.today>=GOAL?"objectif atteint":"cartes et quiz"}</small></div>
      <div><b>${s.words}</b><span>mots acquis</span><small>sur ${Object.keys(CARDS).length}</small></div>
    </div>
    <h2>Médailles · ${won}/${MEDALS.length}</h2>
    <ul class="medals">${medals}</ul>
    <h2>Les chapitres</h2>
    <p class="note">Un chapitre est validé quand tu en maîtrises 80 %. Touche un chapitre pour le réviser.</p>
    <ol class="path">${path}</ol></div>`;
  el.querySelectorAll(".node").forEach(b=>b.onclick=()=>App.goStudy(+b.dataset.u));
}
let tq=[], showing=false;
function toast(ic,html){tq.push([ic,html]); if(!showing) pop()}
function pop(){
  const t=tq.shift(); if(!t){showing=false;return} showing=true;
  const el=document.createElement("div"); el.className="toast"; el.setAttribute("role","status");
  el.innerHTML=`<span class="ic">${t[0]}</span><span>${t[1]}</span>`; document.body.appendChild(el);
  setTimeout(()=>{el.classList.add("out");setTimeout(()=>{el.remove();pop()},300)},2800);
}
return {onReview,onQuizAnswer,onQuizEnd,defiState,bar,renderProgress,checkBadges,medal,ICON};
})();

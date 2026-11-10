/* ============================================================
   ATHX RACE — EastBox
   Application partagée par index.html (adhérents) et admin.html.
   window.ATHX_MODE vaut 'public' ou 'admin'.
   ============================================================ */
(function(){
'use strict';

var MODE   = window.ATHX_MODE === 'admin' ? 'admin' : 'public';
var CFG    = window.ATHX_CONFIG || {};
var DB_URL = (CFG.dbUrl || '').replace(/\/+$/,'');
var LIVE   = !!DB_URL;

var LS_KEY   = 'athx_race_v2';
var LS_MINE  = 'athx_my_team';
var CATS     = ['LITE','ATHX','PRO'];
var CAP_SEC  = 25*60;
var POLL_MS  = 4000;

var METCON = {
  LITE:[ '50 CAL ECHO BIKE',
         '30 SINGLE ARM GTOH — M : 15 kg / F : 7,5 kg',
         '60 m SANDBAG CARRY — M : 40 kg / F : 20 kg',
         '30 BOX STEP OVERS',
         '60 m WALKING LUNGES — bodyweight',
         '60 BURPEE BROAD JUMPS — in place (1 m)',
         '50 CAL ECHO BIKE' ],
  ATHX:[ '50 CAL ECHO BIKE',
         '60 SINGLE ARM ALT GROUND TO OVERHEAD — M : 20 kg / F : 12,5 kg',
         '60 m SANDBAG CARRY — M : 50 kg / F : 30 kg',
         '60 BOX JUMP OVERS — M : moyenne / F : basse',
         '60 m DUAL DB WALKING LUNGES — M : 20 kg / F : 12,5 kg',
         '60 BURPEE BROAD JUMPS — in place (1 m)',
         '50 CAL ECHO BIKE' ],
  PRO:[  '50 CAL ECHO BIKE',
         '60 DUAL GTOH — M : 22,5 kg / F : 15 kg',
         '60 m SANDBAG CARRY — M : 70 kg / F : 40 kg',
         '60 BOX JUMP OVERS — M : haute / F : moyenne',
         '60 m DUAL DB FRONT RACK WALKING LUNGES — M : 22,5 kg / F : 15 kg',
         '60 BURPEE BROAD JUMPS — in place (1 m)',
         '50 CAL ECHO BIKE' ]
};
var RUNDIST = {LITE:500, ATHX:750, PRO:1000};
var TOTREPS = {LITE:340, ATHX:400, PRO:400};
var WAVES = [ {n:1,time:'10h30'}, {n:2,time:'11h00'}, {n:3,time:'11h30'},
              {n:4,time:'12h00'}, {n:5,time:'12h30'} ];
var WAVE_CAP = 5;
var DUOS = {
  H:{key:'H', label:'Duo Hommes', short:'Hommes'},
  F:{key:'F', label:'Duo Femmes', short:'Femmes'},
  X:{key:'X', label:'Duo Mixte',  short:'Mixte'}
};
var DUO_ORDER = ['H','F','X'];

/* ---------- état ---------- */
function blank(){ return {meta:{name:'ATHX Race — Simulation', date:''}, teams:{}, scores:{}}; }
var S     = blank();
var fIns  = 'ALL', fSco = 'ALL', curPart = 'A';
var myId  = null;
var syncState = LIVE ? 'wait' : 'local';
var lastSig = '';

function $(id){ return document.getElementById(id); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
function uid(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function num(v){ var n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:0; }
function teamList(){ var o=S.teams||{}; return Object.keys(o).map(function(k){ return o[k]; })
  .filter(Boolean).sort(function(a,b){ return (a.ts||0)-(b.ts||0); }); }
function getTeam(id){ return (S.teams||{})[id]; }
function duoOf(t){
  if(!t || !t.a || !t.b) return 'X';
  if(t.a.sex==='M' && t.b.sex==='M') return 'H';
  if(t.a.sex==='F' && t.b.sex==='F') return 'F';
  return 'X';
}
function duoBadge(t,short){
  var d=DUOS[duoOf(t)];
  return '<span class="badge duo'+d.key+'">'+(short?d.short:d.label)+'</span>';
}
function waveInfo(n){ for(var i=0;i<WAVES.length;i++){ if(WAVES[i].n===n) return WAVES[i]; } return null; }
function waveTime(n){ var w=waveInfo(n); return w?w.time:''; }
function waveTeams(n){ return teamList().filter(function(t){ return t.wave===n; }); }
function waveFree(n, excludeId){
  var used = waveTeams(n).filter(function(t){ return t.id!==excludeId; }).length;
  return Math.max(0, WAVE_CAP - used);
}
function fillWaveSelect(selected, excludeId){
  var sel=$('tWave'); if(!sel) return;
  var out = ['<option value="">— Choisis ta vague —</option>'];
  WAVES.forEach(function(w){
    var free = waveFree(w.n, excludeId), full = free===0, keep = (selected===w.n);
    var txt = 'Vague '+w.n+' — '+w.time+' · '+
      (full ? 'COMPLÈTE' : free+' place'+(free>1?'s':'')+' restante'+(free>1?'s':''));
    out.push('<option value="'+w.n+'"'+(full&&!keep?' disabled':'')+(keep?' selected':'')+'>'+txt+'</option>');
  });
  sel.innerHTML = out.join('');
}
function renderWaves(){
  var el=$('waveBoard'); if(!el) return;
  el.innerHTML = WAVES.map(function(w){
    var ts = waveTeams(w.n), free = WAVE_CAP - ts.length;
    return '<div style="background:rgba(0,0,0,.22);border:1px solid '+
        (free>0?'var(--line)':'rgba(236,61,59,.5)')+';border-radius:12px;padding:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">'+
        '<div style="font-weight:900;letter-spacing:1.5px;color:var(--orange2);text-transform:uppercase">Vague '+w.n+'</div>'+
        '<div style="font-weight:900;font-size:19px;color:var(--cyan)">'+w.time+'</div></div>'+
      '<div class="hint" style="margin-top:0">'+
        (free>0 ? free+' place'+(free>1?'s':'')+' sur '+WAVE_CAP : 'Vague complète')+'</div>'+
      (ts.length
        ? '<ul class="mv" style="margin-top:8px">'+ts.map(function(t){
            return '<li style="font-size:13px;padding:5px 0 5px 18px'+(t.id===myId?';color:var(--orange2)':'')+'">'+
                   esc(t.name)+' <span class="muted" style="font-weight:600">'+t.cat+'</span></li>'; }).join('')+'</ul>'
        : '<div class="hint" style="font-style:italic">Aucune équipe</div>')+
      '</div>';
  }).join('');
}
var fWave = 'ALL';
function waveFilterBar(el, cur, cb){
  if(!el) return;
  el.innerHTML = ['ALL'].concat(WAVES.map(function(w){ return String(w.n); })).map(function(c){
    return '<button class="chip'+(cur===c?' on':'')+'" data-w="'+c+'">'+
      (c==='ALL'?'Toutes vagues':'V'+c+' · '+waveTime(parseInt(c,10)))+'</button>';
  }).join('');
  el.querySelectorAll('.chip').forEach(function(b){
    b.addEventListener('click', function(){ cb(b.dataset.w); });
  });
}
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

function toast(m){ var t=$('toast'); if(!t) return; t.textContent=m; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(function(){ t.classList.remove('show'); },2600); }

/* une boîte de confirmation intégrée : window.confirm est neutralisé dans certains contextes */
function ask(message, cb){
  var ok = window.confirm(message);
  if(ok) cb();
}

/* ---------- stockage ---------- */
function normalize(d){
  var o = blank();
  if(d && typeof d==='object'){
    if(d.meta && typeof d.meta==='object'){ o.meta.name=d.meta.name||o.meta.name; o.meta.date=d.meta.date||''; }
    if(d.teams && typeof d.teams==='object'){
      if(Array.isArray(d.teams)) d.teams.forEach(function(t){ if(t&&t.id) o.teams[t.id]=t; });
      else Object.keys(d.teams).forEach(function(k){ if(d.teams[k]) o.teams[k]=d.teams[k]; });
    }
    if(d.scores && typeof d.scores==='object') o.scores=d.scores;
  }
  return o;
}
function sig(){ return JSON.stringify(S); }

function saveLocal(){ lsSet(LS_KEY, JSON.stringify(S)); }

function setSync(st){ if(syncState===st) return; syncState=st; renderSync(); }

function api(path, method, body){
  var url = DB_URL + path + '.json';
  var opt = {method:method, headers:{'Content-Type':'application/json'}};
  if(body!==undefined) opt.body = JSON.stringify(body);
  return fetch(url, opt).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.status===204 ? null : r.json();
  });
}

var Store = {
  /* lecture distante -> met à jour S si quelque chose a changé */
  pull:function(){
    if(!LIVE) return Promise.resolve();
    return api('/', 'GET').then(function(d){
      var next = normalize(d);
      var ns = JSON.stringify(next);
      setSync('live');
      if(ns !== sig()){ S = next; afterRemote(); }
    }).catch(function(){ setSync('err'); });
  },
  putTeam:function(t){
    S.teams[t.id]=t;
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    var p={}; p[t.id]=t;
    return api('/teams','PATCH',p).then(function(){ setSync('live'); })
      .catch(function(){ setSync('err'); throw new Error('offline'); });
  },
  delTeam:function(id){
    delete S.teams[id]; if(S.scores) delete S.scores[id];
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    return api('/teams/'+id,'DELETE').then(function(){ return api('/scores/'+id,'DELETE'); })
      .then(function(){ setSync('live'); }).catch(function(){ setSync('err'); });
  },
  putScore:function(teamId, part, obj){
    if(!S.scores[teamId]) S.scores[teamId]={};
    S.scores[teamId][part]=obj;
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    return api('/scores/'+teamId+'/'+part,'PUT',obj)
      .then(function(){ setSync('live'); }).catch(function(){ setSync('err'); });
  },
  putMeta:function(m){
    S.meta=m;
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    return api('/meta','PUT',m).then(function(){ setSync('live'); }).catch(function(){ setSync('err'); });
  },
  replaceAll:function(d){
    S = normalize(d);
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    return api('/','PUT',S).then(function(){ setSync('live'); }).catch(function(){ setSync('err'); });
  },
  clearScores:function(){
    S.scores={};
    if(!LIVE){ saveLocal(); return Promise.resolve(); }
    return api('/scores','DELETE').then(function(){ setSync('live'); }).catch(function(){ setSync('err'); });
  }
};

/* une mise à jour distante est arrivée : on redessine sans casser une saisie en cours */
function afterRemote(){
  var ae = document.activeElement;
  var typing = ae && (ae.tagName==='INPUT'||ae.tagName==='SELECT'||ae.tagName==='TEXTAREA');
  applyMeta(); renderSync(); renderTeams(); renderRank();
  if(!typing) renderScores();
}

/* ---------- onglets ---------- */
function initTabs(){
  qsa('.tab').forEach(function(b){
    b.addEventListener('click', function(){
      qsa('.tab').forEach(function(x){ x.classList.remove('active'); });
      qsa('.panel').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      var p=$('p-'+b.dataset.p); if(p) p.classList.add('active');
      if(b.dataset.p==='classement') renderRank();
      if(b.dataset.p==='scores') renderScores();
      if(b.dataset.p==='inscription') renderTeams();
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
}

/* ---------- WOD ---------- */
function renderMetcon(){
  var g=$('metconGrid'); if(!g) return;
  g.innerHTML = CATS.map(function(c){
    return '<div style="background:rgba(0,0,0,.22);border:1px solid var(--line);border-radius:12px;padding:16px">'+
      '<span class="badge '+c+'">'+c+'</span><ul class="mv">'+
      METCON[c].map(function(l){ return '<li>'+esc(l)+'</li>'; }).join('')+'</ul></div>';
  }).join('');
}

/* ---------- état de synchro ---------- */
function renderSync(){
  var el=$('syncBox'); if(!el) return;
  var map = {
    live : ['live','Classement en direct'],
    wait : ['local','Connexion…'],
    local: ['local','Hors ligne — cet appareil'],
    err  : ['err','Connexion perdue']
  };
  var m = map[syncState] || map.local;
  el.className = 'sync '+m[0];
  el.innerHTML = '<span class="dot"></span>'+m[1];
}

/* ---------- filtres ---------- */
function filterBar(el, cur, cb){
  if(!el) return;
  el.innerHTML = ['ALL'].concat(CATS).map(function(c){
    return '<button class="chip'+(cur===c?' on':'')+'" data-c="'+c+'">'+(c==='ALL'?'Toutes':c)+'</button>';
  }).join('');
  el.querySelectorAll('.chip').forEach(function(b){
    b.addEventListener('click', function(){ cb(b.dataset.c); });
  });
}

/* ---------- inscriptions ---------- */
function readForm(){
  return {
    name: $('tName').value.trim(),
    cat:  $('tCat').value,
    a:{ name:$('aName').value.trim(), sex:$('aSex').value },
    b:{ name:$('bName').value.trim(), sex:$('bSex').value },
    note: $('tNote') ? $('tNote').value.trim() : '',
    wave: $('tWave') ? (parseInt($('tWave').value,10)||0) : 0
  };
}
function fillForm(t){
  $('tName').value=t.name; $('tCat').value=t.cat;
  $('aName').value=t.a.name; $('aSex').value=t.a.sex;
  $('bName').value=t.b.name; $('bSex').value=t.b.sex;
  if($('tNote')) $('tNote').value=t.note||'';
  fillWaveSelect(t.wave||0, t.id);
  updateDuoPreview();
}
function clearForm(){
  $('teamForm').reset(); $('editId').value=''; $('tCat').value='ATHX';
  fillWaveSelect(0, null);
  updateDuoPreview();
  $('formTitle').textContent = MODE==='admin' ? 'Nouvelle équipe' : 'Inscris ton équipe';
  $('submitBtn').textContent = MODE==='admin' ? "Inscrire l'équipe" : "Valider l'inscription";
  if($('cancelEdit')) $('cancelEdit').style.display='none';
}
function updateDuoPreview(){
  var el=$('duoPreview'); if(!el) return;
  var fake={a:{sex:$('aSex').value}, b:{sex:$('bSex').value}};
  el.innerHTML = '<span class="lbl">Sous-catégorie</span>'+duoBadge(fake)+
    '<span class="hint" style="margin:0">déterminée par le sexe des deux athlètes</span>';
}
function initForm(){
  var f=$('teamForm'); if(!f) return;
  ['aSex','bSex'].forEach(function(id){
    if($(id)) $(id).addEventListener('change', updateDuoPreview);
  });
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var editId = $('editId').value;
    var d = readForm();
    if(!d.name || !d.a.name || !d.b.name){ toast('Remplis le nom de l’équipe et les 2 athlètes'); return; }
    if(!d.wave){ toast('Choisis ta vague de départ'); return; }
    var id = editId || uid();
    var prev = getTeam(id);
    var t = {id:id, name:d.name, cat:d.cat, a:d.a, b:d.b, note:d.note, wave:d.wave,
             ts:(prev&&prev.ts)||Date.now()};
    var btn=$('submitBtn'); btn.disabled=true;
    (LIVE ? Store.pull() : Promise.resolve()).then(function(){
      if(waveFree(d.wave, id) <= 0){ renderTeams(); throw {full:true}; }
      return Store.putTeam(t);
    }).then(function(){
      if(MODE==='public'){ myId=id; lsSet(LS_MINE,id); }
      toast(editId ? 'Équipe modifiée' : 'Équipe inscrite !');
      clearForm(); renderTeams(); renderScores(); renderRank();
    }).catch(function(err){
      if(err && err.full) toast('Vague '+d.wave+' complète entre-temps — choisis-en une autre');
      else toast('Enregistrement impossible — vérifie ta connexion');
    }).then(function(){ btn.disabled=false; });
  });
  if($('cancelEdit')) $('cancelEdit').addEventListener('click', function(){ clearForm(); renderTeams(); });
}
function editTeam(id){
  var t=getTeam(id); if(!t) return;
  $('editId').value=t.id; fillForm(t);
  $('formTitle').textContent='Modifier l’équipe';
  $('submitBtn').textContent='Enregistrer';
  if($('cancelEdit')) $('cancelEdit').style.display='inline-flex';
  qs('[data-p="inscription"]').click();
}
function delTeam(id){
  var t=getTeam(id); if(!t) return;
  ask('Supprimer définitivement l’équipe « '+t.name+' » et ses scores ?', function(){
    Store.delTeam(id).then(function(){
      if(myId===id){ myId=null; lsDel(LS_MINE); }
      toast('Équipe supprimée'); renderTeams(); renderScores(); renderRank();
    });
  });
}
window.athxEdit = editTeam;
window.athxDel  = delTeam;

function renderTeams(){
  var list = teamList();
  renderWaves();
  var wsel=$('tWave');
  if(wsel && document.activeElement!==wsel){
    fillWaveSelect(parseInt(wsel.value,10)||0, $('editId') ? ($('editId').value||null) : null);
  }
  if($('teamCount')) $('teamCount').textContent = list.length;

  /* bloc « mon équipe » côté adhérent */
  var mineBox = $('myTeam');
  if(mineBox){
    var mt = myId ? getTeam(myId) : null;
    if(!mt && myId){ myId=null; lsDel(LS_MINE); }
    if(mt){
      mineBox.style.display='block';
      mineBox.innerHTML =
        '<div class="card mine-card"><h3>Ton équipe</h3>'+
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">'+
          '<div><div class="team-n" style="font-size:19px">'+esc(mt.name)+'</div>'+
          '<div class="ath">'+esc(mt.a.name)+' ('+mt.a.sex+') &amp; '+esc(mt.b.name)+' ('+mt.b.sex+')</div></div>'+
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
            '<span class="badge '+mt.cat+'">'+mt.cat+'</span>'+
            duoBadge(mt)+
            (mt.wave?'<span class="badge LITE">Vague '+mt.wave+' · '+waveTime(mt.wave)+'</span>':'')+
            '<button class="btn ghost sm" onclick="athxEdit(\''+mt.id+'\')">Modifier</button>'+
          '</div></div>'+
        '<div class="hint">Tu peux corriger ton inscription jusqu’au départ. Pour tout autre changement, vois avec le coach.</div></div>';
      var fw=$('formWrap'); if(fw && !$('editId').value) fw.style.display='none';
    } else {
      mineBox.style.display='none';
      var fw2=$('formWrap'); if(fw2) fw2.style.display='block';
    }
  }

  var tb = qs('#teamTable tbody'); if(!tb) return;
  var shown = list.filter(function(t){ return fIns==='ALL'||t.cat===fIns; });
  filterBar($('filtersIns'), fIns, function(c){ fIns=c; renderTeams(); });
  if($('teamEmpty')) $('teamEmpty').style.display = shown.length?'none':'block';
  var wrapEl = qs('#teamTable').closest('.tbl-wrap');
  if(wrapEl) wrapEl.style.display = shown.length?'block':'none';

  tb.innerHTML = shown.map(function(t,i){
    var acts = MODE==='admin'
      ? '<td><div class="row-actions">'+
          '<button class="btn ghost sm" onclick="athxEdit(\''+t.id+'\')">Modifier</button>'+
          '<button class="btn danger sm" onclick="athxDel(\''+t.id+'\')">Suppr.</button></div></td>'
      : '';
    var noteCell = MODE==='admin' ? '<td class="ath">'+esc(t.note||'—')+'</td>' : '';
    return '<tr'+(t.id===myId?' class="mine"':'')+'>'+
      '<td class="num muted">'+(i+1)+'</td>'+
      '<td class="team-n">'+esc(t.name)+(t.id===myId?' <span class="badge ATHX">toi</span>':'')+'</td>'+
      '<td><span class="badge '+t.cat+'">'+t.cat+'</span></td>'+
      '<td>'+duoBadge(t,true)+'</td>'+
      '<td class="num">'+(t.wave
        ? 'V'+t.wave+' <span class="muted" style="font-weight:600">'+waveTime(t.wave)+'</span>'
        : '<span class="muted">—</span>')+'</td>'+
      '<td><div>'+esc(t.a.name)+' <span class="muted">('+t.a.sex+')</span></div>'+
          '<div>'+esc(t.b.name)+' <span class="muted">('+t.b.sex+')</span></div></td>'+
      noteCell + acts + '</tr>';
  }).join('');
}

/* ---------- saisie des scores (admin) ---------- */
function initScoreTabs(){
  qsa('[data-part]').forEach(function(b){
    b.addEventListener('click', function(){
      qsa('[data-part]').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on'); curPart=b.dataset.part; renderScores();
    });
  });
}
function headBlock(t){
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'+
    '<div><div class="team-n">'+esc(t.name)+'</div>'+
    '<div class="ath">'+esc(t.a.name)+' ('+t.a.sex+') &amp; '+esc(t.b.name)+' ('+t.b.sex+')</div></div>'+
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
      '<span class="badge '+t.cat+'">'+t.cat+'</span>'+
      duoBadge(t,true)+
      (t.wave?'<span class="badge LITE">V'+t.wave+' · '+waveTime(t.wave)+'</span>':'')+
    '</div></div>';
}
function renderScores(){
  var host=$('scoreList'); if(!host) return;
  filterBar($('filtersScores'), fSco, function(c){ fSco=c; renderScores(); });
  waveFilterBar($('filtersWave'), fWave, function(w){ fWave=w; renderScores(); });
  var list = teamList().filter(function(t){
    return (fSco==='ALL'||t.cat===fSco) && (fWave==='ALL'||String(t.wave)===fWave); });
  if($('scoreEmpty')) $('scoreEmpty').style.display = list.length?'none':'block';
  host.innerHTML = list.map(cardFor).join('');
}
function cardFor(t){
  var s = S.scores[t.id] || {};
  if(curPart==='A'){
    var a = s.A || {};
    var f = function(k,lbl){
      return '<div><label>'+lbl+'</label><input type="number" min="0" step="0.5" inputmode="decimal" '+
        'value="'+(a[k]!=null?a[k]:'')+'" oninput="athxSetA(\''+t.id+'\',\''+k+'\',this.value)" placeholder="kg"></div>';
    };
    return '<div class="card">'+headBlock(t)+'<div class="grid2">'+
      '<div><label style="color:var(--cyan)">1RM Strict Press</label><div class="split">'+
        f('p1','Athlète A — '+esc(t.a.name))+f('p2','Athlète B — '+esc(t.b.name))+'</div></div>'+
      '<div><label style="color:var(--cyan)">3RM Back Squat</label><div class="split">'+
        f('s1','Athlète A')+f('s2','Athlète B')+'</div></div>'+
      '<div><label style="color:var(--cyan)">5RM Deadlift</label><div class="split">'+
        f('d1','Athlète A')+f('d2','Athlète B')+'</div></div>'+
      '<div><label style="color:var(--orange2)">Total de la paire</label>'+
        '<div class="tot" id="totA-'+t.id+'">'+fmtKg(totalA(t.id))+'</div></div>'+
      '</div></div>';
  }
  if(curPart==='B'){
    var b = s.B || {};
    return '<div class="card">'+headBlock(t)+'<div class="grid2">'+
      '<div><label>Distance RUN cumulée (m)</label><input type="number" min="0" step="50" inputmode="numeric" value="'+
        (b.run!=null?b.run:'')+'" oninput="athxSetB(\''+t.id+'\',\'run\',this.value)" placeholder="ex. 3000"></div>'+
      '<div><label>Distance ROW cumulée (m)</label><input type="number" min="0" step="50" inputmode="numeric" value="'+
        (b.row!=null?b.row:'')+'" oninput="athxSetB(\''+t.id+'\',\'row\',this.value)" placeholder="ex. 3480"></div>'+
      '<div><label style="color:var(--orange2)">Distance totale de la paire</label>'+
        '<div class="tot" id="totB-'+t.id+'">'+fmtM(totalB(t.id))+'</div></div></div>'+
      '<div class="hint">Segment de RUN pour cette catégorie : <b>'+RUNDIST[t.cat]+' m</b>. Le score retenu est la somme RUN + ROW.</div></div>';
  }
  var c = s.C || {};
  var fin = c.fin!==false;
  return '<div class="card">'+headBlock(t)+'<div class="grid2">'+
    '<div><label>Épreuve terminée ?</label><select onchange="athxSetFin(\''+t.id+'\',this.value===\'1\')">'+
      '<option value="1"'+(fin?' selected':'')+'>Oui — temps réalisé</option>'+
      '<option value="0"'+(!fin?' selected':'')+'>Non — time cap atteint</option></select></div>'+
    (fin
      ? '<div><label>Temps (min : sec)</label><div class="inline-3">'+
          '<input type="number" min="0" max="25" inputmode="numeric" value="'+(c.min!=null?c.min:'')+
            '" oninput="athxSetC(\''+t.id+'\',\'min\',this.value)" placeholder="min">'+
          '<input type="number" min="0" max="59" inputmode="numeric" value="'+(c.sec!=null?c.sec:'')+
            '" oninput="athxSetC(\''+t.id+'\',\'sec\',this.value)" placeholder="sec">'+
          '<div class="tot" style="min-width:92px" id="totC-'+t.id+'">'+fmtC(t)+'</div></div></div>'
      : '<div><label>Répétitions réalisées au cap</label><div class="inline-3">'+
          '<input type="number" min="0" max="'+TOTREPS[t.cat]+'" inputmode="numeric" value="'+(c.reps!=null?c.reps:'')+
            '" oninput="athxSetC(\''+t.id+'\',\'reps\',this.value)" placeholder="reps">'+
          '<div></div><div class="tot" style="min-width:92px" id="totC-'+t.id+'">'+fmtC(t)+'</div></div>'+
          '<div class="hint">Total de reps de la catégorie '+t.cat+' : <b>'+TOTREPS[t.cat]+'</b></div></div>')+
    '</div></div>';
}

/* écriture différée : on ne pousse qu'après une courte pause de frappe */
var pending = {};
function queueWrite(teamId, part){
  var k = teamId+'|'+part;
  clearTimeout(pending[k]);
  pending[k] = setTimeout(function(){
    Store.putScore(teamId, part, (S.scores[teamId]||{})[part] || {});
  }, 500);
}
function athxSetA(id,k,v){
  if(!S.scores[id]) S.scores[id]={}; if(!S.scores[id].A) S.scores[id].A={};
  if(v==='') delete S.scores[id].A[k]; else S.scores[id].A[k]=num(v);
  if(!LIVE) saveLocal();
  var el=$('totA-'+id); if(el) el.textContent=fmtKg(totalA(id));
  queueWrite(id,'A'); renderRankSoon();
}
function athxSetB(id,k,v){
  if(!S.scores[id]) S.scores[id]={}; if(!S.scores[id].B) S.scores[id].B={};
  if(v==='') delete S.scores[id].B[k]; else S.scores[id].B[k]=num(v);
  if(!LIVE) saveLocal();
  var el=$('totB-'+id); if(el) el.textContent=fmtM(totalB(id));
  queueWrite(id,'B'); renderRankSoon();
}
function athxSetC(id,k,v){
  if(!S.scores[id]) S.scores[id]={}; if(!S.scores[id].C) S.scores[id].C={};
  if(v==='') delete S.scores[id].C[k]; else S.scores[id].C[k]=num(v);
  if(!LIVE) saveLocal();
  var el=$('totC-'+id); if(el) el.textContent=fmtC(getTeam(id));
  queueWrite(id,'C'); renderRankSoon();
}
function athxSetFin(id,v){
  if(!S.scores[id]) S.scores[id]={}; if(!S.scores[id].C) S.scores[id].C={};
  S.scores[id].C.fin = v;
  if(!LIVE) saveLocal();
  queueWrite(id,'C'); renderScores(); renderRankSoon();
}
window.athxSetA=athxSetA; window.athxSetB=athxSetB;
window.athxSetC=athxSetC; window.athxSetFin=athxSetFin;

var rankTimer=null;
function renderRankSoon(){ clearTimeout(rankTimer); rankTimer=setTimeout(renderRank,400); }

/* ---------- valeurs ---------- */
function totalA(id){
  var a=(S.scores[id]||{}).A; if(!a) return null;
  var ks=['p1','p2','s1','s2','d1','d2'];
  if(!ks.some(function(k){ return a[k]!=null; })) return null;
  return ks.reduce(function(n,k){ return n+(a[k]||0); },0);
}
function totalB(id){
  var b=(S.scores[id]||{}).B; if(!b) return null;
  if(b.run==null && b.row==null) return null;
  return (b.run||0)+(b.row||0);
}
function valC(id){
  var c=(S.scores[id]||{}).C; if(!c) return null;
  if(c.fin===false){ if(c.reps==null) return null; return {fin:false, reps:c.reps}; }
  if(c.min==null && c.sec==null) return null;
  return {fin:true, sec:Math.min((c.min||0)*60+(c.sec||0), CAP_SEC)};
}
function fmtKg(v){ return v==null?'—':(Math.round(v*10)/10)+' kg'; }
function fmtM(v){ return v==null?'—':v.toLocaleString('fr-FR')+' m'; }
function mmss(s){ var m=Math.floor(s/60), r=Math.round(s%60); return m+':'+String(r).padStart(2,'0'); }
function fmtC(t){ if(!t) return '—'; var v=valC(t.id); if(!v) return '—';
  return v.fin ? mmss(v.sec) : 'CAP · '+v.reps+' reps'; }

/* ---------- classement ---------- */
function rankPart(teams, part){
  var vals = teams.map(function(t){
    var v=null;
    if(part==='A') v=totalA(t.id);
    if(part==='B') v=totalB(t.id);
    if(part==='C') v=valC(t.id);
    return {id:t.id, v:v, has:v!=null};
  });
  var scored = vals.filter(function(x){ return x.has; });
  scored.sort(function(x,y){
    if(part==='C'){
      if(x.v.fin!==y.v.fin) return x.v.fin?-1:1;
      if(x.v.fin) return x.v.sec-y.v.sec;
      return y.v.reps-x.v.reps;
    }
    return y.v-x.v;
  });
  var eq = function(a,b){
    if(part!=='C') return a===b;
    if(a.fin!==b.fin) return false;
    return a.fin ? a.sec===b.sec : a.reps===b.reps;
  };
  var out={}, rank=0, prev=null;
  scored.forEach(function(x,i){
    if(prev===null || !eq(x.v,prev)) rank=i+1;
    out[x.id]=rank; prev=x.v;
  });
  var last = teams.length;
  vals.filter(function(x){ return !x.has; }).forEach(function(x){ out[x.id]=last; });
  return out;
}
function computeGroup(teams){
  if(!teams.length) return [];
  var rA=rankPart(teams,'A'), rB=rankPart(teams,'B'), rC=rankPart(teams,'C');
  var rows = teams.map(function(t){
    return {t:t, a:rA[t.id], b:rB[t.id], c:rC[t.id],
            pts:rA[t.id]+rB[t.id]+rC[t.id],
            vA:totalA(t.id), vB:totalB(t.id), vC:valC(t.id)};
  });
  rows.sort(function(x,y){
    return x.pts-y.pts || x.c-y.c || x.b-y.b || x.a-y.a || x.t.name.localeCompare(y.t.name);
  });
  var rank=0, prev=null;
  rows.forEach(function(r,i){ if(prev===null||r.pts!==prev) rank=i+1; r.rank=rank; prev=r.pts; });
  return rows;
}
function computeCat(cat){
  return computeGroup(teamList().filter(function(t){ return t.cat===cat; }));
}
var rankMode = 'cat';
function renderRankModeBar(){
  var el=$('rankMode'); if(!el) return;
  var opts=[['cat','Par catégorie'],['duo','Par catégorie et duo']];
  el.innerHTML = opts.map(function(o){
    return '<button class="chip'+(rankMode===o[0]?' on':'')+'" data-rm="'+o[0]+'">'+o[1]+'</button>';
  }).join('');
  el.querySelectorAll('.chip').forEach(function(b){
    b.addEventListener('click', function(){ rankMode=b.dataset.rm; renderRank(); });
  });
}
function rankBlocks(){
  var out=[];
  CATS.forEach(function(cat){
    var inCat = teamList().filter(function(t){ return t.cat===cat; });
    if(rankMode==='cat'){
      out.push({label:cat, title:'<span class="badge '+cat+'">'+cat+'</span> Classement général ·',
                rows:computeGroup(inCat)});
    } else {
      DUO_ORDER.forEach(function(d){
        var rows = computeGroup(inCat.filter(function(t){ return duoOf(t)===d; }));
        if(!rows.length) return;
        out.push({label:cat+' — '+DUOS[d].label,
                  title:'<span class="badge '+cat+'">'+cat+'</span><span class="badge duo'+d+'">'+
                        DUOS[d].label+'</span> ·',
                  rows:rows});
      });
    }
  });
  return out;
}
function renderRank(){
  var host=$('rankings'); if(!host) return;
  renderRankModeBar();
  var html = rankBlocks().map(function(blk){
    var rows = blk.rows;
    if(!rows.length) return '';
    return '<div class="card"><h3 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
      blk.title+' '+rows.length+' équipe'+(rows.length>1?'s':'')+'</h3>'+
      '<div class="tbl-wrap"><table><thead><tr>'+
        '<th style="width:54px">Rang</th><th>Équipe</th>'+
        '<th>Part A<br><span style="font-weight:600;text-transform:none;color:#7f93b4">Strength</span></th>'+
        '<th>Part B<br><span style="font-weight:600;text-transform:none;color:#7f93b4">Endurance</span></th>'+
        '<th>Part C<br><span style="font-weight:600;text-transform:none;color:#7f93b4">Metcon X</span></th>'+
        '<th style="width:80px">Points</th></tr></thead><tbody>'+
      rows.map(function(r){
        return '<tr'+(r.t.id===myId?' class="mine"':'')+'>'+
          '<td><span class="rk'+(r.rank<4?' p'+r.rank:'')+'">'+r.rank+'</span></td>'+
          '<td><div class="team-n">'+esc(r.t.name)+(r.t.id===myId?' <span class="badge ATHX">toi</span>':'')+'</div>'+
              '<div class="ath">'+esc(r.t.a.name)+' &amp; '+esc(r.t.b.name)+
              (rankMode==='cat' ? ' '+duoBadge(r.t,true) : '')+'</div></td>'+
          '<td><div class="num">'+fmtKg(r.vA)+'</div><div class="sub-pts">'+r.a+' pt'+(r.a>1?'s':'')+'</div></td>'+
          '<td><div class="num">'+fmtM(r.vB)+'</div><div class="sub-pts">'+r.b+' pt'+(r.b>1?'s':'')+'</div></td>'+
          '<td><div class="num">'+(r.vC?(r.vC.fin?mmss(r.vC.sec):'CAP · '+r.vC.reps+' reps'):'—')+'</div>'+
              '<div class="sub-pts">'+r.c+' pt'+(r.c>1?'s':'')+'</div></td>'+
          '<td><span class="pts">'+r.pts+'</span></td></tr>';
      }).join('')+'</tbody></table></div></div>';
  }).join('');
  host.innerHTML = html || '<div class="empty">Le classement s’affichera dès les premières équipes inscrites.</div>';
}

/* ---------- méta ---------- */
function applyMeta(){
  var t=qs('.race-title'); if(t) t.textContent=S.meta.name;
  document.title=S.meta.name+' — EastBox';
  var d=S.meta.date, el=$('raceDate');
  if(el) el.textContent = d
    ? new Date(d+'T00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    : 'Course en équipe · 2 athlètes';
  if($('evName')) $('evName').value=S.meta.name;
  if($('evDate')) $('evDate').value=S.meta.date||'';
}

/* ---------- outils admin ---------- */
function dl(blob,name){
  var u=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=u; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); },1500);
}
function initAdminTools(){
  if($('tvBtn')) $('tvBtn').addEventListener('click', function(){
    document.body.classList.add('tv');
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function(){});
  });
  if($('tvExit')) $('tvExit').addEventListener('click', function(){ document.body.classList.remove('tv'); });
  if($('printBtn')) $('printBtn').addEventListener('click', function(){ window.print(); });
  if($('csvBtn')) $('csvBtn').addEventListener('click', function(){
    var rows=[['Groupe','Rang','Equipe','Categorie','Duo','Vague','Heure','Athlete A','Athlete B','Part A (kg)','Pts A','Part B (m)','Pts B','Part C','Pts C','Total points']];
    rankBlocks().forEach(function(blk){ blk.rows.forEach(function(r){
      rows.push([blk.label, r.rank, r.t.name, r.t.cat, DUOS[duoOf(r.t)].label,
        r.t.wave||'', waveTime(r.t.wave)||'', r.t.a.name, r.t.b.name,
        r.vA!=null?r.vA:'', r.a, r.vB!=null?r.vB:'', r.b,
        r.vC?(r.vC.fin?mmss(r.vC.sec):'CAP '+r.vC.reps+' reps'):'', r.c, r.pts]);
    });});
    var csv='﻿'+rows.map(function(l){
      return l.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(';'); }).join('\n');
    dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'classement-athx.csv');
  });
  if($('exportBtn')) $('exportBtn').addEventListener('click', function(){
    dl(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),
       'athx-race-'+new Date().toISOString().slice(0,10)+'.json');
    toast('Course exportée');
  });
  if($('importBtn')) $('importBtn').addEventListener('click', function(){ $('importFile').click(); });
  if($('importFile')) $('importFile').addEventListener('change', function(e){
    var f=e.target.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      var d; try{ d=JSON.parse(r.result); }catch(err){ toast('Fichier illisible'); return; }
      if(!d || typeof d!=='object'){ toast('Fichier invalide'); return; }
      ask('Remplacer la course actuelle par le fichier importé ?', function(){
        Store.replaceAll(d).then(function(){ refresh(); toast('Course importée'); });
      });
    };
    r.readAsText(f); e.target.value='';
  });
  if($('resetScores')) $('resetScores').addEventListener('click', function(){
    ask('Effacer TOUS les scores ? Les équipes sont conservées.', function(){
      Store.clearScores().then(function(){ refresh(); toast('Scores effacés'); });
    });
  });
  if($('resetAll')) $('resetAll').addEventListener('click', function(){
    ask('Tout supprimer : équipes ET scores. Cette action est définitive.', function(){
      Store.replaceAll(blank()).then(function(){ refresh(); toast('Course remise à zéro'); });
    });
  });
  if($('saveMeta')) $('saveMeta').addEventListener('click', function(){
    Store.putMeta({ name: $('evName').value.trim()||'ATHX Race — Simulation', date: $('evDate').value })
      .then(function(){ applyMeta(); toast('Enregistré'); });
  });
  if($('demoBtn')) $('demoBtn').addEventListener('click', function(){
    ask('Charger 6 équipes de démonstration ? La course actuelle sera remplacée.', function(){
      var d=blank();
      var demo=[['Les Rhinos','LITE','Julie M.','F','Paul R.','M'],
                ['Ocean Team','LITE','Sarah B.','F','Nina L.','F'],
                ['Les Bulldogs','ATHX','Marc T.','M','Léa D.','F'],
                ['Fire Squad','ATHX','Kevin P.','M','Tom A.','M'],
                ['Apex','PRO','Chloé V.','F','Hugo S.','M'],
                ['Iron Wolves','PRO','Lucas G.','M','Enzo F.','M']];
      demo.forEach(function(x,i){
        var id='demo'+i, k=1+i*0.07;
        d.teams[id]={id:id,name:x[0],cat:x[1],a:{name:x[2],sex:x[3]},b:{name:x[4],sex:x[5]},
                     note:'Heat '+(i%3+1), wave:(i%5)+1, ts:Date.now()+i};
        d.scores[id]={ A:{p1:Math.round(45*k),p2:Math.round(38*k),s1:Math.round(95*k),
                          s2:Math.round(80*k),d1:Math.round(130*k),d2:Math.round(110*k)},
                       B:{run:3000+i*250, row:3200+i*180},
                       C: i===3 ? {fin:false,reps:300+i*5} : {fin:true,min:18+(i%4),sec:(i*11)%60} };
      });
      Store.replaceAll(d).then(function(){ refresh(); toast('Démo chargée'); });
    });
  });
}

/* ---------- bandeau de configuration ---------- */
function renderBanner(){
  var el=$('cfgBanner'); if(!el) return;
  if(LIVE){ el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML = MODE==='admin'
    ? '<b>Mode hors ligne.</b> Aucune base partagée n’est configurée : les équipes et les scores restent '+
      'sur cet appareil uniquement, et les adhérents ne verront rien depuis leur téléphone. '+
      'Renseigne <b>dbUrl</b> dans le fichier <b>config.js</b> pour activer le direct.'
    : '<b>Mode hors ligne.</b> Les inscriptions ne sont pas encore reliées à la salle. '+
      'Préviens le coach avant de t’inscrire ici.';
}

/* ---------- démarrage ---------- */
function refresh(){ applyMeta(); renderSync(); renderTeams(); renderScores(); renderRank(); }

function start(){
  renderMetcon(); initTabs(); initForm(); initScoreTabs(); initAdminTools();
  renderBanner(); clearForm();
  myId = MODE==='public' ? lsGet(LS_MINE) : null;

  if(LIVE){
    refresh();
    Store.pull().then(function(){ refresh(); });
    setInterval(function(){ Store.pull(); }, POLL_MS);
  } else {
    var raw = lsGet(LS_KEY);
    if(raw){ try{ S = normalize(JSON.parse(raw)); }catch(e){ S = blank(); } }
    refresh();
    window.addEventListener('storage', function(e){
      if(e.key===LS_KEY){ try{ S=normalize(JSON.parse(e.newValue||'{}')); }catch(err){} refresh(); }
    });
  }
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape') document.body.classList.remove('tv');
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();

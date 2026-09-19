(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const TYPES = [
    ...Array.from({length:9},(_,i)=>`${i+1}m`), ...Array.from({length:9},(_,i)=>`${i+1}p`), ...Array.from({length:9},(_,i)=>`${i+1}s`),
    ...Array.from({length:7},(_,i)=>`${i+1}z`)
  ];
  const SUITS = ['m','p','s'];
  const LABELS = {m:'萬子',p:'筒子',s:'索子',z:'字牌'};
  const HONOR_NAMES = {1:'東',2:'南',3:'西',4:'北',5:'白',6:'發',7:'中'};
  const DEFAULT_RULES = { players:4, openTanyao:true, kiriage:false, kazoe:true, doubleYakuman:true, doubleWind4:false, redDora:true, uraDora:true };
  const saved = (() => { try { return JSON.parse(localStorage.getItem('mahjong4Rules') || 'null'); } catch { return null; }})();
  const rules = {...DEFAULT_RULES, ...(saved && saved.players === 4 ? saved : {})};

  let hand = [];
  let melds = [];
  let win = null;
  let red = new Set();
  let doraIndicators = new Set();
  let uraIndicators = new Set();
  let manualHan = 2;
  let manualDealer = false;
  let pending = {};
  let scorePlayer = 'child';
  let scoreRange = 'normal';

  const yakuCatalog = [
    {name:'立直', han:1, open:'—', freq:41.85, note:'門前のみ'},
    {name:'一発', han:1, open:'—', freq:9.19, note:'立直系'},
    {name:'門前清自摸和', han:1, open:'—', freq:17.79, note:'門前のみ'},
    {name:'断么九', han:1, open:1, freq:23.33, note:'喰いタン設定時'},
    {name:'平和', han:1, open:'—', freq:19.88, note:'門前のみ'},
    {name:'一盃口', han:1, open:'—', freq:4.25, note:'門前のみ'},
    {name:'役牌', han:1, open:1, freq:null, note:'自風・場風・三元牌など。出現率は牌種・局面で変動'},
    {name:'海底摸月', han:1, open:1, freq:0.36, note:''},
    {name:'河底撈魚', han:1, open:1, freq:0.58, note:''},
    {name:'嶺上開花', han:1, open:1, freq:0.28, note:''},
    {name:'槍槓', han:1, open:1, freq:0.05, note:''},
    {name:'ダブル立直', han:2, open:'—', freq:0.21, note:'門前のみ'},
    {name:'三色同順', han:2, open:1, freq:3.40, note:'鳴くと1翻'},
    {name:'一気通貫', han:2, open:1, freq:1.60, note:'鳴くと1翻'},
    {name:'混全帯么九', han:2, open:1, freq:1.10, note:'鳴くと1翻'},
    {name:'七対子', han:2, open:'—', freq:2.20, note:'25符固定'},
    {name:'対々和', han:2, open:2, freq:3.10, note:''},
    {name:'三色同刻', han:2, open:2, freq:0.05, note:''},
    {name:'三暗刻', han:2, open:2, freq:0.69, note:''},
    {name:'三槓子', han:2, open:2, freq:0.005, note:''},
    {name:'小三元', han:2, open:2, freq:0.11, note:'役牌2組分を別途加算'},
    {name:'混老頭', han:2, open:2, freq:0.054, note:'対々和などと複合'},
    {name:'純全帯么九', han:3, open:2, freq:0.34, note:'鳴くと2翻'},
    {name:'混一色', han:3, open:2, freq:6.27, note:'鳴くと2翻'},
    {name:'二盃口', han:3, open:'—', freq:0.048, note:'門前のみ'},
    {name:'清一色', han:6, open:5, freq:0.85, note:'鳴くと5翻'},
    {name:'国士無双', han:13, open:'役満', freq:null, note:'役満'},
    {name:'四暗刻', han:13, open:'役満', freq:null, note:'役満'},
    {name:'大三元', han:13, open:'役満', freq:null, note:'役満'},
    {name:'小四喜', han:13, open:'役満', freq:null, note:'役満'},
    {name:'大四喜', han:13, open:'役満', freq:null, note:'役満扱いは卓差あり'},
    {name:'字一色', han:13, open:'役満', freq:null, note:'役満'},
    {name:'緑一色', han:13, open:'役満', freq:null, note:'役満'},
    {name:'清老頭', han:13, open:'役満', freq:null, note:'役満'},
    {name:'九蓮宝燈', han:13, open:'役満', freq:null, note:'純正形はダブル設定に依存'},
    {name:'四槓子', han:13, open:'役満', freq:null, note:'役満'},
    {name:'天和', han:13, open:'役満', freq:null, note:'役満'},
    {name:'地和', han:13, open:'役満', freq:null, note:'役満'}
  ];

  const el = id => $(id);
  const tilePath = t => `tiles/${t}.svg`;
  const tileImg = (t, cls='') => `<img class="${cls}" src="${tilePath(t)}" alt="${t}">`;
  const clone = o => JSON.parse(JSON.stringify(o));
  const suit = t => t[1];
  const num = t => +t[0];
  const isHonor = t => suit(t)==='z';
  const isTerminal = t => !isHonor(t) && (num(t)===1 || num(t)===9);
  const isSimple = t => !isHonor(t) && num(t)>=2 && num(t)<=8;
  const isTerminalOrHonor = t => isHonor(t) || isTerminal(t);
  const isWind = t => ['1z','2z','3z','4z'].includes(t);
  const isDragon = t => ['5z','6z','7z'].includes(t);
  const idOf = t => TYPES.indexOf(t);

  function counts(arr){ const c={}; arr.forEach(t=>c[t]=(c[t]||0)+1); return c; }
  function allTiles(){ return [...hand, ...melds.flatMap(m=>m.tiles)]; }
  function unique(arr){ return [...new Set(arr)]; }
  function tileCount(t){ return hand.filter(x=>x===t).length + melds.reduce((a,m)=>a+m.tiles.filter(x=>x===t).length,0); }
  function closed(){ return melds.every(m=>m.type==='ankan'); }
  function openMelds(){ return melds.filter(m=>m.type!=='ankan'); }
  function groupKey(g){ return g.join(','); }
  function isSeq(g){ return g.length===3 && !isHonor(g[0]) && suit(g[0])===suit(g[1]) && suit(g[1])===suit(g[2]) && num(g[1])===num(g[0])+1 && num(g[2])===num(g[1])+2; }
  function isTrip(g){ return g.length>=3 && g.every(t=>t===g[0]); }
  function sortedTiles(arr){ return [...arr].sort((a,b)=>idOf(a)-idOf(b)); }

  function nextDora(ind){
    if (isHonor(ind)) {
      if (['1z','2z','3z','4z'].includes(ind)) return ['1z','2z','3z','4z'][(['1z','2z','3z','4z'].indexOf(ind)+1)%4];
      return ['5z','6z','7z'][(['5z','6z','7z'].indexOf(ind)+1)%3];
    }
    return `${num(ind)===9?1:num(ind)+1}${suit(ind)}`;
  }

  function doraCount(){
    if (!rules.redDora && !rules.uraDora) return 0;
    const tiles=allTiles(); let n=0;
    doraIndicators.forEach(i=>{ const d=nextDora(i); n+=tiles.filter(t=>t===d).length; });
    if (rules.redDora) red.forEach(t=>{ if (['5m','5p','5s'].includes(t)) n += hand.filter(x=>x===t).length>0 ? 1 : 0; });
    if (rules.uraDora && (el('riichi').checked || el('doubleRiichi').checked)) uraIndicators.forEach(i=>{ const d=nextDora(i); n+=tiles.filter(t=>t===d).length; });
    return n;
  }

  function renderTileGroups(target, onPick, opts={}){
    target.innerHTML='';
    ['m','p','s','z'].forEach(s=>{
      const box=document.createElement('div'); box.className='tile-group';
      const h=document.createElement('h3'); h.textContent=LABELS[s]; box.appendChild(h);
      const grid=document.createElement('div'); grid.className='tile-grid-modal';
      TYPES.filter(t=>suit(t)===s).forEach(t=>{
        const b=document.createElement('button'); b.className='tile-choice'; b.innerHTML=tileImg(t);
        b.title=t; b.onclick=()=>onPick(t); grid.appendChild(b);
      }); box.appendChild(grid); target.appendChild(box);
    });
  }

  function openModal(id){ el(id).classList.remove('hidden'); }
  function closeModal(id){ el(id).classList.add('hidden'); }
  document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m) m.classList.add('hidden')}));

  function navigate(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); window.scrollTo({top:0,behavior:'smooth'}); if(id==='scoreScreen')renderScoreTable(); if(id==='yakuScreen')renderYakuTable(); }
  document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.screen)));
  document.querySelectorAll('.backBtn').forEach(b=>b.addEventListener('click',()=>navigate('homeScreen')));
  el('homeBtn').onclick=()=>navigate('homeScreen');

  function updateRuleSummary(){
    const bits=['四人麻雀']; if(rules.openTanyao)bits.push('喰いタン'); if(rules.kiriage)bits.push('切り上げ満貫'); if(rules.redDora)bits.push('赤ドラ'); if(rules.uraDora)bits.push('裏ドラ');
    el('ruleSummary').textContent=bits.join(' ・ ');
  }
  function loadSettingsUI(){ ['openTanyao','kiriage','kazoe','doubleYakuman','doubleWind4','redDora','uraDora'].forEach(k=>el(`set${k.charAt(0).toUpperCase()+k.slice(1)}`).checked=!!rules[k]); }
  el('settingsBtn').onclick=()=>{loadSettingsUI();openModal('settingsModal')};
  el('saveSettings').onclick=()=>{ ['openTanyao','kiriage','kazoe','doubleYakuman','doubleWind4','redDora','uraDora'].forEach(k=>rules[k]=el(`set${k.charAt(0).toUpperCase()+k.slice(1)}`).checked); localStorage.setItem('mahjong4Rules',JSON.stringify(rules)); updateRuleSummary(); closeModal('settingsModal'); syncRuleEffects(); analyze(); manualCalc(); };

  // Calculator tabs
  document.querySelectorAll('.calc-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.calc-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.calc-pane').forEach(x=>x.classList.remove('active'));el(`${b.dataset.calcTab}Pane`).classList.add('active')});

  // Manual calculator
  ['ankoC','ankoY','minkoC','minkoY','ankanC','ankanY','minkanC','minkanY'].forEach(k=>{const s=el(`m_${k}`);for(let i=0;i<=4;i++)s.add(new Option(i,i));s.addEventListener('change',manualCalc)});
  ['janto','machi','agari','special','manualOn','manualFu'].forEach(k=>el(`m_${k}`).addEventListener('change',manualCalc));
  el('m_minus').onclick=()=>{manualHan=Math.max(0,manualHan-1);el('m_han').textContent=manualHan;manualCalc()};
  el('m_plus').onclick=()=>{manualHan=Math.min(26,manualHan+1);el('m_han').textContent=manualHan;manualCalc()};
  document.querySelectorAll('[data-parent]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-parent]').forEach(x=>x.classList.remove('active'));b.classList.add('active');manualDealer=b.dataset.parent==='true';manualCalc()}));

  function manualCalc(){
    const v=k=>+el(`m_${k}`).value;
    const mf=v('ankoC')*4+v('ankoY')*8+v('minkoC')*2+v('minkoY')*4+v('ankanC')*16+v('ankanY')*32+v('minkanC')*8+v('minkanY')*16;
    const pair=el('m_janto').value==='役牌'?2:0;
    const wait=['両面','シャンポン'].includes(el('m_machi').value)?0:2;
    const winfu=el('m_agari').value==='ロン'?0:2;
    let sub=mf+pair+wait+winfu;
    const sp=el('m_special').value;
    let f=sp==='七対子'?25:sp==='平和ツモ'?20:sp==='門前ロン'?sub+10:sub+20;
    if(el('m_manualOn').checked) f=Math.max(0,+el('m_manualFu').value||0);
    el('m_mentsuFu').textContent=`${mf}符`; el('m_subtotal').textContent=`${sub}符`; el('m_fu').textContent=`${f}符`;
    const res=scoreResult(manualHan,f,manualDealer,el('m_agari').value==='ロン');
    let label=limitLabel(manualHan);
    el('m_score').textContent=label?label+'（'+res.text+'）':res.text;
    el('m_aoten').textContent=formatNum(aoten(manualHan,f))+'点';
    el('m_manualFu').disabled=!el('m_manualOn').checked;
  }

  // Hand picker
  el('openHandPicker').onclick=()=>{
    renderTileGroups(el('tilePicker'), t=>{
      const max=14-melds.reduce((a,m)=>a+m.tiles.length,0);
      if(hand.length>=max){return}
      if(tileCount(t)>=4)return;
      hand.push(t); renderHand(); renderWin(); analyze();
    }); openModal('tileModal');
  };
  el('clearHand').onclick=()=>{hand=[];win=null;red.clear();['m','p','s'].forEach(s=>el(`red5${s}`).checked=false);renderHand();renderWin();analyze()};
  ['m','p','s'].forEach(s=>el(`red5${s}`).addEventListener('change',()=>{const t=`5${s}`;if(!rules.redDora){el(`red5${s}`).checked=false;return} if(el(`red5${s}`).checked)red.add(t);else red.delete(t);analyze()}));

  function renderHand(){
    const box=el('handView'); box.innerHTML=''; const c=counts(hand); Object.keys(c).forEach(t=>{});
    hand.forEach((t,i)=>{const b=document.createElement('button');b.className='tile-mini';b.innerHTML=tileImg(t);b.title='タップで1枚削除';b.onclick=e=>{e.stopPropagation(); hand.splice(i,1); if(win===t && !hand.includes(t))win=null;renderHand();renderWin();analyze()};box.appendChild(b)});
    el('handPlaceholder').style.display=hand.length?'none':'inline'; el('handCount').textContent=hand.length; el('handLimit').textContent=14-melds.reduce((a,m)=>a+m.tiles.length,0);
  }

  // Meld entry
  el('openMeldPicker').onclick=()=>openModal('meldModal');
  document.querySelectorAll('[data-meld-type]').forEach(b=>b.onclick=()=>{closeModal('meldModal'); if(b.dataset.meldType==='pon')startPon(); if(b.dataset.meldType==='chi')startChi(); if(b.dataset.meldType==='kan')openModal('kanModal');});
  document.querySelectorAll('[data-kan-type]').forEach(b=>b.onclick=()=>{pending.kanType=b.dataset.kanType;closeModal('kanModal');startKan()});
  function startPon(){renderTileGroups(el('ponTiles'),t=>{if(hand.filter(x=>x===t).length<2)return;pending.type='pon';pending.tile=t;closeModal('ponModal');openModal('calledFromModal')});openModal('ponModal')}
  document.querySelectorAll('[data-called-from]').forEach(b=>b.onclick=()=>{pending.from=b.dataset.calledFrom; if(pending.kanType==='minkan')pending.type='minkan'; closeModal('calledFromModal');openModal('orientationModal')});
  function commitPon(){ const t=pending.tile; if(hand.filter(x=>x===t).length<2)return; if(!takeFromHand(t,2))return; melds.push({type:'pon',tiles:[t,t,t],calledTile:t,from:pending.from,orientation:pending.orientation}); renderMelds(); renderHand(); analyze(); pending={}; }
  function commitMinkan(){ const t=pending.kanTile; if(hand.filter(x=>x===t).length<3)return; if(!takeFromHand(t,3))return; melds.push({type:'minkan',tiles:[t,t,t,t],calledTile:t,from:pending.from,orientation:pending.orientation||'left'}); renderMelds(); renderHand(); analyze(); pending={}; }
  document.querySelectorAll('[data-orientation]').forEach(b=>b.addEventListener('click',()=>{
    pending.orientation=b.dataset.orientation; closeModal('orientationModal');
    if(Number.isInteger(pending.editMeld)){const i=pending.editMeld;melds[i].orientation=b.dataset.orientation;pending.editMeld=null;renderMelds();analyze();return;}
    if(pending.type==='pon')commitPon(); else if(pending.type==='minkan')commitMinkan();
  }));

  function startChi(){
    const c=counts(hand); const sets=[];
    SUITS.forEach(s=>{
      for(let n=1;n<=7;n++){
        const ts=[`${n}${s}`,`${n+1}${s}`,`${n+2}${s}`];
        if(ts.every(t=>(c[t]||0)>=1)) sets.push(ts);
      }
    });
    if(!sets.length){alert('現在の牌から作れる順子がありません');return;}
    const box=el('chiSets'); box.innerHTML='';
    sets.forEach(ts=>{
      const b=document.createElement('button');
      b.className='chi-called-card';
      b.innerHTML=ts.map(t=>tileImg(t,'meld-tile')).join('');
      b.onclick=()=>{
        pending.chiSet=ts; closeModal('chiModal');
        const cc=el('chiCalledTiles'); cc.innerHTML='';
        ts.forEach(t=>{
          const b2=document.createElement('button');
          b2.innerHTML=`鳴いた牌 ${tileImg(t,'meld-tile')}`;
          b2.onclick=()=>{pending.calledTile=t;pending.type='chi';pending.from='left';pending.orientation='left';closeModal('chiCalledModal');commitChi()};
          cc.appendChild(b2);
        });
        openModal('chiCalledModal');
      };
      box.appendChild(b);
    });
    openModal('chiModal');
  }
  function commitChi(){const ts=pending.chiSet; if(hand.length+melds.reduce((a,m)=>a+m.tiles.length,0)+3>14)return; // consume one of each from concealed hand
    const h=hand.slice(); for(const t of ts){const i=h.indexOf(t);if(i<0)return;} for(const t of ts){h.splice(h.indexOf(t),1)} hand=h; melds.push({type:'chi',tiles:ts,calledTile:pending.calledTile,from:'left',orientation:'left'});renderHand();renderMelds();analyze();pending={};}
  function startKan(){
    const type=pending.kanType; const available=unique(allTiles()); const can=[];
    available.forEach(t=>{const n=hand.filter(x=>x===t).length;const existingPon=melds.some(m=>m.type==='pon'&&m.tiles[0]===t); if(type==='ankan'&&n>=4)can.push(t); if(type==='minkan'&&n>=3)can.push(t); if(type==='shouminkan'&&existingPon&&n>=1)can.push(t)});
    if(!can.length){alert(type==='shouminkan'?'加槓できるポンがありません':'選択可能なカンがありません');return}
    const box=el('kanTiles');box.innerHTML='';can.forEach(t=>{const b=document.createElement('button');b.className='tile-choice';b.innerHTML=tileImg(t);b.onclick=()=>{pending.kanTile=t; if(type==='minkan'){closeModal('kanTilesModal');openModal('calledFromModal')} else {closeModal('kanTilesModal'); if(type==='shouminkan'){commitShouminkan()} else commitAnkan()}};box.appendChild(b)});el('kanTilesTitle').textContent=type==='ankan'?'暗槓：牌を選択':type==='minkan'?'大明槓：牌を選択':'加槓：牌を選択';openModal('kanTilesModal');
  }
  function takeFromHand(t,n){for(let k=0;k<n;k++){const i=hand.indexOf(t);if(i<0)return false;hand.splice(i,1)}return true}
  function commitAnkan(){const t=pending.kanTile;if(!takeFromHand(t,4))return;melds.push({type:'ankan',tiles:[t,t,t,t],calledTile:null,from:null,orientation:null});renderHand();renderMelds();analyze();pending={}}
  function commitShouminkan(){const t=pending.kanTile;const i=melds.findIndex(m=>m.type==='pon'&&m.tiles[0]===t);if(i<0||!takeFromHand(t,1))return; const old=melds[i];melds[i]={...old,type:'shouminkan',tiles:[t,t,t,t]};renderHand();renderMelds();analyze();pending={}}
  function renderMelds(){
    const list=el('meldList');list.innerHTML='';const view=el('meldView');view.innerHTML='';
    el('meldPlaceholder').style.display=melds.length?'none':'inline';
    melds.forEach((m,i)=>{
      const card=document.createElement('button');card.className='meld-card'; card.title='タップして編集';
      const orientationIndex=m.type==='ankan'? -1 : (m.orientation==='left'?0:m.orientation==='middle'?1:2);
      m.tiles.forEach((t,j)=>{const x=document.createElement('span');x.className='meld-tile'+(j===orientationIndex?' rotated':'');x.innerHTML=(m.type==='ankan'&&(j===0||j===m.tiles.length-1))?'<img src="tiles/tile-back.svg" alt="裏向き">':tileImg(t);card.appendChild(x)});
      const del=document.createElement('span');del.className='del';del.textContent='×';card.appendChild(del);card.onclick=e=>{if(e.target===del){melds.splice(i,1);renderMelds();renderHand();analyze()}else openMeldEdit(i)};list.appendChild(card);
      const v=card.cloneNode(true);v.onclick=()=>openMeldEdit(i);view.appendChild(v);
    });
  }
  function openMeldEdit(i){const m=melds[i];const body=el('editMeldBody');body.innerHTML=`<p>種類：<b>${m.type==='chi'?'チー':m.type==='pon'?'ポン':m.type==='ankan'?'暗槓':m.type==='minkan'?'大明槓':'加槓'}</b></p><div class="edit-actions"><button id="editRotate">鳴いた牌の位置を変更</button><button id="editDelete">この副露を削除</button></div>`;el('editDelete').onclick=()=>{melds.splice(i,1);closeModal('editMeldModal');renderMelds();renderHand();analyze()};el('editRotate').onclick=()=>{closeModal('editMeldModal');if(m.type==='ankan')return;openModal('orientationModal');pending.editMeld=i};openModal('editMeldModal')}

  // Win selection
  function renderWin(){
    const box=el('winChoices');box.innerHTML='';const seen=unique(hand); seen.forEach(t=>{const b=document.createElement('button');b.className='tile-mini';b.innerHTML=tileImg(t);b.title=win===t?'和了牌を解除':'和了牌にする'; if(win===t)b.style.outline='2px solid #2563eb'; b.onclick=e=>{e.stopPropagation();win=win===t?null:t;renderWin();analyze()};box.appendChild(b)});
  }
  el('winView').addEventListener('click',()=>{if(!hand.length)return;renderWin();});

  // dora picker
  function renderMiniPicker(target, set){target.innerHTML='';TYPES.forEach(t=>{const b=document.createElement('button');b.innerHTML=tileImg(t);b.classList.toggle('selected',set.has(t));b.onclick=()=>{if(set.has(t))set.delete(t);else {if(set.size>=5)return;set.add(t)}renderMiniPicker(target,set);analyze()};target.appendChild(b)})}
  renderMiniPicker(el('doraPicker'),doraIndicators); renderMiniPicker(el('uraPicker'),uraIndicators);

  ['seat','round','dealer','winMethod','riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'].forEach(id=>el(id).addEventListener('change',analyze));
  const specialIds=['riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'];
  el('specialYakuSelect').querySelector('.multi-select-toggle').onclick=e=>{e.stopPropagation();el('specialYakuSelect').classList.toggle('open')};
  document.addEventListener('click',e=>{if(!el('specialYakuSelect').contains(e.target))el('specialYakuSelect').classList.remove('open')});
  function updateSpecialLabel(){const n=specialIds.filter(x=>el(x).checked).length;el('specialYakuCount').textContent=n?`（${n}件）`:''}
  specialIds.forEach(id=>el(id).addEventListener('change',updateSpecialLabel));

  function decompositions(tiles, groupsNeeded){
    const c=counts(tiles); const out=[]; const keys=Object.keys(c).sort((a,b)=>idOf(a)-idOf(b));
    function rec(arr,g,pair){
      if(arr.length===0){if(g.length===groupsNeeded&&pair)out.push({groups:g.map(x=>x.slice()),pair:[pair,pair]});return}
      if(g.length>groupsNeeded)return;
      const t=arr.slice().sort((a,b)=>idOf(a)-idOf(b))[0]; let cc=counts(arr);
      if(!pair && cc[t]>=2) rec(arr.slice(0, arr.indexOf(t)).concat(arr.slice(arr.indexOf(t)+2)),g,[t,t]);
      if(g.length<groupsNeeded && cc[t]>=3){let a=arr.slice();for(let i=0;i<3;i++)a.splice(a.indexOf(t),1);rec(a,g.concat([[t,t,t]]),pair)}
      if(g.length<groupsNeeded&&!isHonor(t)&&num(t)<=7){const ts=[t,`${num(t)+1}${suit(t)}`,`${num(t)+2}${suit(t)}`];if(ts.every(x=>(cc[x]||0)>0)){let a=arr.slice();ts.forEach(x=>a.splice(a.indexOf(x),1));rec(a,g.concat([ts]),pair)}}
    }
    rec(tiles.slice(),[],null);
    const seen=new Set();return out.filter(d=>{const k=d.groups.map(groupKey).sort().join('|')+'|'+d.pair[0];if(seen.has(k))return false;seen.add(k);return true});
  }

  function isChiitoi(){if(melds.length)return false;if(hand.length!==14)return false;const c=counts(hand);return Object.keys(c).length===7&&Object.values(c).every(n=>n===2)}
  function isKokushi(){if(melds.length)return false;if(hand.length!==14)return false;const req=['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];const c=counts(hand);return req.every(t=>c[t]>=1)&&req.some(t=>c[t]>=2)}
  function isKokushi13(){if(!isKokushi()||!win)return false;const req=['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];const c=counts(hand);return req.every(t=>c[t]===1 || (t===win&&c[t]===2))}

  function fixedGroups(){return melds.map(m=>m.tiles.slice())}
  function shapeData(d){return {groups:[...fixedGroups(),...(d?.groups||[])],pair:d?.pair||null}}
  function groupList(s){return s.groups}
  function allShapeTiles(s){return [...s.groups.flatMap(g=>g),...(s.pair||[])];}
  function hasTrip(s,t){return s.groups.some(g=>isTrip(g)&&g[0]===t)}
  function hasSeq(s,key){return s.groups.some(g=>isSeq(g)&&groupKey(g)===key)}
  function yakuList(d){
    const s=shapeData(d), all=allShapeTiles(s), gs=s.groups, seqs=gs.filter(isSeq), trips=gs.filter(isTrip), kans=melds.filter(m=>m.type.includes('kan')), open=!closed(); const r=[];
    const add=(name,han,type='normal')=>r.push({name,han,type});
    if(el('doubleRiichi').checked && closed()) add('ダブル立直',2);
    else if(el('riichi').checked && closed()) add('立直',1);
    if(el('ippatsu').checked && (el('riichi').checked||el('doubleRiichi').checked) && closed())add('一発',1);
    if(el('winMethod').value==='tsumo' && closed())add('門前清自摸和',1);
    if(el('rinshan').checked && el('winMethod').value==='tsumo')add('嶺上開花',1);
    if(el('chankan').checked && el('winMethod').value==='ron')add('槍槓',1);
    if(el('haitei').checked && el('winMethod').value==='tsumo')add('海底摸月',1);
    if(el('houtei').checked && el('winMethod').value==='ron')add('河底撈魚',1);
    if(el('tenhou').checked && el('winMethod').value==='tsumo' && el('dealer').value==='true' && closed())add('天和',13,'yakuman');
    if(el('chiihou').checked && el('winMethod').value==='tsumo' && el('dealer').value==='false' && closed())add('地和',13,'yakuman');
    if(isKokushi()){add(isKokushi13()&&rules.doubleYakuman?'国士無双十三面待ち':'国士無双',isKokushi13()&&rules.doubleYakuman?26:13,'yakuman');return r;}
    if(isChiitoi()){add('七対子',2);}
    else {
      if(s.pair){
        const pair=s.pair[0]; const valued=isDragon(pair)||pair===el('seat').value||pair===el('round').value;
        if(closed()&&seqs.length===4&&!valued && waitType(d)==='ryanmen')add('平和',1);
      }
      if(all.length && all.every(isSimple) && (!open || rules.openTanyao))add('断么九',1);
      if(closed()){
        const seqKeys=seqs.map(groupKey); if(new Set(seqKeys).size<seqKeys.length){
          const countsSeq={};seqKeys.forEach(k=>countsSeq[k]=(countsSeq[k]||0)+1);
          if(Object.values(countsSeq).filter(x=>x===2).length>=2)add('二盃口',3);else if(Object.values(countsSeq).some(x=>x>=2))add('一盃口',1);
        }
      }
      // Yakuhai separately so multiple sets are counted.
      trips.forEach(g=>{const t=g[0];if(isDragon(t))add('役牌',1);if(t===el('seat').value)add('自風牌',1);if(t===el('round').value)add('場風牌',1)});
      if(trips.length===4)add('対々和',2);
      // concealed triplets: a ron-completed triplet isn't counted as concealed.
      let concealedTriplets=0; gs.forEach(g=>{if(!isTrip(g))return;const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g));if(fixed){if(fixed.type==='ankan')concealedTriplets++;return;} if(el('winMethod').value==='ron' && win && g.includes(win))return;concealedTriplets++});
      if(concealedTriplets>=3)add('三暗刻',2);
      if(kans.length>=3)add('三槓子',2);
      const seqBy=(n,ss)=>seqs.some(g=>g[0]===`${n}${ss}`);
      if([1,4,7].every(n=>SUITS.some(ss=>seqBy(n,ss)))){} // no-op placeholder
      for(let n=1;n<=7;n++){if(SUITS.every(ss=>seqBy(n,ss))){add('三色同順',open?1:2);break}}
      for(const ss of SUITS){if([1,4,7].every(n=>seqBy(n,ss))){add('一気通貫',open?1:2);break}}
      for(let n=1;n<=9;n++){if(SUITS.every(ss=>trips.some(g=>g[0]===`${n}${ss}`))){add('三色同刻',2);break}}
      // chanta / junchan
      const pairHasTO=s.pair&&isTerminalOrHonor(s.pair[0]);
      const allHaveTO=gs.every(g=>g.some(isTerminalOrHonor));
      const hasSeq=seqs.length>0;
      if(pairHasTO&&allHaveTO&&hasSeq){if(all.every(t=>!isHonor(t)))add('純全帯么九',open?2:3);else add('混全帯么九',open?1:2)}
      if(all.every(isTerminalOrHonor) && gs.every(isTrip)){
        if(all.every(isTerminal))add('清老頭',13,'yakuman');
        else if(all.every(isHonor))add('字一色',13,'yakuman');
        else add('混老頭',2);
      }
      const dragonTrips=['5z','6z','7z'].filter(t=>hasTrip(s,t)).length; const dragonPair=s.pair&&isDragon(s.pair[0]);
      if(dragonTrips===2&&dragonPair)add('小三元',2);
      if(dragonTrips===3)add('大三元',13,'yakuman');
      const windTrips=['1z','2z','3z','4z'].filter(t=>hasTrip(s,t)).length; const windPair=s.pair&&isWind(s.pair[0]);
      if(windTrips===3&&windPair)add('小四喜',13,'yakuman');
      if(windTrips===4)add('大四喜',rules.doubleYakuman?26:13,'yakuman');
      if(gs.length===4&&isSuuankou(s))add('四暗刻'+(isSuuankouTanki(s)?'単騎':''),isSuuankouTanki(s)&&rules.doubleYakuman?26:13,'yakuman');
      if(kans.length===4)add('四槓子',13,'yakuman');
      if(all.every(t=>['2s','3s','4s','6s','8s','6z'].includes(t)))add('緑一色',13,'yakuman');
      if(closed()&&all.length===14&&isChuurenShape(all)){
        const pure=isPureChuuren(all,win);add(pure&&rules.doubleYakuman?'純正九蓮宝燈':'九蓮宝燈',pure&&rules.doubleYakuman?26:13,'yakuman');
      }
      const suits=unique(all.filter(t=>!isHonor(t)).map(suit)); const honor=all.some(isHonor);
      if(suits.length===1){if(honor)add('混一色',open?2:3);else add('清一色',open?5:6)}
    }
    return r;
  }

  function waitType(d){
    if(!d||!win)return null; const s=shapeData(d);
    if(s.pair && s.pair[0]===win)return 'tanki';
    const g=s.groups.find(x=>x.includes(win)); if(!g)return null;
    if(isTrip(g))return 'shanpon';
    if(isSeq(g)){const a=num(g[0]),n=num(win);if((a===1&&n===3)||(a===7&&n===7))return 'penchan';if(n===a+1)return 'kanchan';return 'ryanmen'}
    return null;
  }
  function isSuuankou(s){
    let n=0; for(const g of s.groups){if(!isTrip(g))continue; const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g)); if(fixed){if(fixed.type==='ankan')n++;continue;} if(el('winMethod').value==='ron'&&win&&g.includes(win))continue; n++;} return n===4 && closed();
  }
  function isSuuankouTanki(s){return isSuuankou(s)&&s.pair&&s.pair[0]===win}
  function isChuurenShape(all){const suits=unique(all.map(suit));if(suits.length!==1||isHonor(all[0]))return false;const c=counts(all);const ss=suits[0];const req={1:3,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:3};return Object.keys(req).every(n=>(c[`${n}${ss}`]||0)>=req[n])}
  function isPureChuuren(all,w){if(!w)return false;const c=counts(all),ss=suit(all[0]);const base={1:3,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:3};return Object.keys(base).every(n=>(c[`${n}${ss}`]||0)===base[n])&&c[w]===base[w]+1;}

  function fuCalc(d){
    if(isChiitoi())return 25;
    const s=shapeData(d); if(!s.pair)return 0; let f=20;
    const wm=el('winMethod').value; if(wm==='ron'&&closed())f+=10;
    if(wm==='tsumo')f+=2;
    s.groups.forEach(g=>{
      if(isSeq(g))return;
      const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g)); const t=g[0], toh=isTerminalOrHonor(t);
      if(fixed){ if(fixed.type==='ankan')f+=toh?32:16; else if(fixed.type==='minkan'||fixed.type==='shouminkan')f+=toh?16:8; else if(fixed.type==='pon')f+=toh?4:2; }
      else f+=toh?4:2;
    });
    const pair=s.pair[0]; const valued=isDragon(pair)||pair===el('seat').value||pair===el('round').value; if(valued)f+=2; if(rules.doubleWind4&&pair===el('seat').value&&pair===el('round').value)f+=2;
    const wt=waitType(d); if(['tanki','kanchan','penchan'].includes(wt))f+=2;
    const ys=yakuList(d); if(ys.some(y=>y.name==='平和')&&wm==='tsumo')return 20;
    return Math.ceil(f/10)*10;
  }

  function limitLabel(h){if(h>=13&&rules.kazoe)return'数え役満';if(h>=11)return'三倍満';if(h>=8)return'倍満';if(h>=6)return'跳満';if(h>=5)return'満貫';return''}
  function basePoints(h,fu){if(h>=13&&rules.kazoe)return 8000;if(h>=11)return 6000;if(h>=8)return 4000;if(h>=6)return 3000;if(h>=5)return 2000;let b=fu*Math.pow(2,h+2);if(rules.kiriage&&((h===4&&fu>=30)||(h===3&&fu>=60)))b=2000;return Math.min(2000,b)}
  function scoreResult(h,fu,dealer,isRon){const b=Math.ceil(basePoints(h,fu)/100)*100;if(isRon)return {text:`${(b*(dealer?6:4)).toLocaleString()}点`};return dealer?{text:`${(b*2).toLocaleString()}点オール`}:{text:`${b.toLocaleString()}・${(b*2).toLocaleString()}点`};}
  function formatNum(n){return Number(n).toLocaleString('ja-JP')}
  function aoten(h,fu){return Math.ceil(fu*Math.pow(2,h+2)/100)*100}
  function yakumanMultiplier(ys){return ys.filter(y=>y.type==='yakuman').reduce((a,y)=>a+y.han/13,0)}
  function scoreYakuman(mult,isRon,dealer){const b=8000*mult;if(isRon)return `${formatNum(b*(dealer?6:4))}点`;return dealer?`${formatNum(b*2)}点オール`:`${formatNum(b*2)}・${formatNum(b)}点`;}

  function renderShape(d){const box=el('selectedShape');box.innerHTML='';if(!d)return;const s=shapeData(d);const groups=s.groups;groups.forEach(g=>{const b=document.createElement('div');b.className='shape-group';b.innerHTML=g.map(tileImg).join('');box.appendChild(b)});if(s.pair){const b=document.createElement('div');b.className='shape-group shape-pair';b.innerHTML=s.pair.map(tileImg).join('');box.appendChild(b)}}

  function analyze(){
    const st=el('status'); const res=el('yakuResult');res.innerHTML='';el('selectedShape').innerHTML='';el('totalHan').textContent='—';el('totalFu').textContent='—';el('autoScore').textContent='—';el('autoAoten').textContent='—';
    updateSpecialLabel();
    const physical=hand.length+melds.reduce((a,m)=>a+m.tiles.length,0);
    if(physical!==14){st.className='status';st.textContent=`現在${physical}枚。手牌と副露を合わせて14枚にしてね`;return}
    if(!win){st.className='status';st.textContent='和了牌を選択してね';return}
    if(tileCount(win)<1){st.className='status err';st.textContent='和了牌が手牌にありません';return}
    if(isKokushi()||isChiitoi()){
      const d={groups:[],pair:null}; const ys=yakuList(d); const ym=yakumanMultiplier(ys); finish(d,ys,ym); return;
    }
    const need=4-melds.length;if(need<0){st.className='status err';st.textContent='副露数が多すぎます';return}
    const ds=decompositions(hand,need);let best=null;
    ds.forEach(d=>{const ys=yakuList(d);const ym=yakumanMultiplier(ys);let h=ys.filter(y=>y.type!=='yakuman').reduce((a,y)=>a+y.han,0)+doraCount();let fu=fuCalc(d);const valid=ys.length>0; if(!valid)return; const key={d,ys,ym,h,fu}; if(!best||ym>best.ym||(ym===best.ym&&(h>best.h||(h===best.h&&fu>best.fu))))best=key});
    if(!best){st.className='status err';st.textContent='役が成立していないか、牌姿を分解できません';return}
    finish(best.d,best.ys,best.ym,best);
  }
  function finish(d,ys,ym,best){
    const st=el('status'); const yakuman=ym>=1; const doraH=doraCount(); const h=(best?best.h:ys.filter(y=>y.type!=='yakuman').reduce((a,y)=>a+y.han,0)+doraH); const fu=best?best.fu:25;
    st.className='status ok';st.textContent=yakuman?`${ym===2?'ダブル':ym>2?ym+'倍':''}役満判定`:'判定完了';
    renderShape(d);
    el('yakuResult').innerHTML=ys.map(y=>`<div class="yaku"><span>${y.name}</span><b>${y.type==='yakuman'?(y.han===26?'ダブル役満':'役満'):`${y.han}飜`}</b></div>`).join('') + (doraH&&!yakuman?`<div class="yaku"><span>ドラ（赤・裏を含む）</span><b>${doraH}飜</b></div>`:'');
    el('totalHan').textContent=yakuman?`${ym}倍相当の役満`: `${h}飜`; el('totalFu').textContent=yakuman?'—':`${fu}符`;
    const dealer=el('dealer').value==='true', ron=el('winMethod').value==='ron'; el('autoScore').textContent=yakuman?scoreYakuman(ym,ron,dealer):(limitLabel(h)?`${limitLabel(h)}：${scoreResult(h,fu,dealer,ron).text}`:scoreResult(h,fu,dealer,ron).text); el('autoAoten').textContent=yakuman?'—':`${formatNum(aoten(h,fu))}点`;
  }

  // Yaku score restriction and settings sync
  function syncRuleEffects(){['red5m','red5p','red5s'].forEach(id=>{el(id).disabled=!rules.redDora;if(!rules.redDora){el(id).checked=false;red.clear()}});}

  // Score table
  function handValue(h,fu,dealer,isRon){const b=basePoints(h,fu);const ceil=x=>Math.ceil(x/100)*100; if(isRon)return ceil(b)*(dealer?6:4); if(dealer)return `${ceil(b*2)}点オール`;return `${ceil(b*2)} / ${ceil(b)}点`;}
  function renderScoreTable(){
    const wrap=el('scoreTableWrap');wrap.innerHTML='';
    if(scoreRange==='limit'){const rows=[['満貫',5],['跳満',6],['倍満',8],['三倍満',11],['数え役満',13]];let html='<table class="score-table"><thead><tr><th>段階</th><th>ロン</th><th>ツモ</th></tr></thead><tbody>';rows.forEach(([name,h])=>{if(h===13&&!rules.kazoe)return;const fu=30;const ron=scoreResult(h,fu,scorePlayer==='parent',true).text;const ts=scoreResult(h,fu,scorePlayer==='parent',false).text;html+=`<tr><th>${name}<br><small>${h}飜相当</small></th><td>${ron}</td><td>${ts}</td></tr>`}); const yakRon=scoreYakuman(1,true,scorePlayer==='parent'),yakTs=scoreYakuman(1,false,scorePlayer==='parent');html+=`<tr class="cap"><th>役満</th><td>${yakRon}</td><td>${yakTs}</td></tr>`;html+='</tbody></table>';wrap.innerHTML=html;return;}
    const fus=[20,25,30,40,50,60,70,80,90,100,110], hans=[1,2,3,4,5]; let html='<table class="score-table"><thead><tr><th>符 ＼ 飜</th>'+hans.map(h=>`<th>${h}飜</th>`).join('')+'</tr></thead><tbody>';
    fus.forEach(f=>{html+=`<tr><th>${f}符</th>`;hans.forEach(h=>{const impossible=(h===1&&f===20)||(h===1&&f===25); if(impossible)html+='<td>—</td>';else if(h===5){const r=scoreResult(h,f,scorePlayer==='parent',true).text,ts=scoreResult(h,f,scorePlayer==='parent',false).text;html+=`<td class="cap"><span class="ron">${r}</span><span class="tsumo">${ts}</span></td>`}else{const r=handValue(h,f,scorePlayer==='parent',true),ts=handValue(h,f,scorePlayer==='parent',false);html+=`<td><span class="ron">${formatNum(r)}点</span><span class="tsumo">${ts}</span></td>`}});html+='</tr>'});html+='</tbody></table>';wrap.innerHTML=html;
  }
  document.querySelectorAll('[data-score-player]').forEach(b=>b.onclick=()=>{scorePlayer=b.dataset.scorePlayer;document.querySelectorAll('[data-score-player]').forEach(x=>x.classList.toggle('active',x===b));renderScoreTable()});
  document.querySelectorAll('[data-score-range]').forEach(b=>b.onclick=()=>{scoreRange=b.dataset.scoreRange;document.querySelectorAll('[data-score-range]').forEach(x=>x.classList.toggle('active',x===b));renderScoreTable()});

  function renderYakuTable(){
    const mode=el('yakuSort').value; const arr=clone(yakuCatalog).sort((a,b)=>mode==='han'?(b.han-a.han)||(b.freq??-1)-(a.freq??-1):mode==='frequency'?((b.freq??-1)-(a.freq??-1))||a.han-b.han:a.name.localeCompare(b.name,'ja'));
    el('yakuTableBody').innerHTML=arr.map(y=>{const closedV=y.han>=13?'役満':`${y.han}飜`;let openV='—';if(y.han<13&&y.open!=='—')openV=typeof y.open==='number'?`${y.open}飜`:'—';const down=(y.han<13&&typeof y.open==='number'&&y.open<y.han)?'あり':'なし';const freq=y.freq==null?'—':`${y.freq.toFixed(y.freq<0.1?3:2)}%`;return `<tr><td><strong>${y.name}</strong><br><small>${y.note||''}</small></td><td>${closedV}</td><td>${openV}</td><td>${down}</td><td>${freq}</td></tr>`}).join('');
  }
  el('yakuSort').onchange=renderYakuTable;

  // prevent contradictory manual choices
  function syncManualConflicts(){
    const a=el('m_agari').value,s=el('m_special').value;
    [...el('m_special').options].forEach(o=>o.disabled=false);
    [...el('m_agari').options].forEach(o=>o.disabled=false);
    if(a==='ツモ') [...el('m_special').options].find(o=>o.value==='門前ロン')?.setAttribute('disabled','disabled');
    if(a==='ロン') [...el('m_special').options].find(o=>o.value==='平和ツモ')?.setAttribute('disabled','disabled');
    if(s==='門前ロン')el('m_agari').value='ロン';
    if(s==='平和ツモ')el('m_agari').value='ツモ';
  }
  el('m_agari').addEventListener('change',syncManualConflicts); el('m_special').addEventListener('change',syncManualConflicts);

  // Initial setup
  updateRuleSummary();loadSettingsUI();syncRuleEffects();updateSpecialLabel();syncManualConflicts();renderHand();renderWin();renderMelds();manualCalc();analyze();
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
})();

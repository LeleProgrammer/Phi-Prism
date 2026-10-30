(function () {
  'use strict';
  const P=window.Phi, $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg aria-hidden="true"><use href="#i-${n}"/></svg>`, fmt=n=>Number(n).toLocaleString('en-US');
  const S={save:null,view:'best',n:30,query:'',level:'all',chapter:'all',grade:'all',sort:'rks',min:0,max:30,page:1,gain:.01,songId:null,customBackground:'',customAvatar:'',canvas:null,renderId:0};
  const LS={cache:'phi-prism.current.v1',history:'phi-prism.history.v1',token:'phi-prism.token.v1'};
  let tokenMemory='',toastTimer,storageWarned=false,previewTimer,bestTimer;
  function readStore(k,fallback=null){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback;}catch{return fallback;}}
  function writeStore(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{if(!storageWarned){toast('浏览器无法保存本地数据，请及时导出 JSON 备份。');storageWarned=true;}return false;}}
  function removeStore(k){try{localStorage.removeItem(k);}catch{}}
  function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
  const date=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'本地导入';
  function account(save=S.save){return save.demo?'demo':save.profile.account || save.profile.name;}
  function history(){const h=readStore(LS.history,[]);return Array.isArray(h)?h:[];}
  function snapshots(){return history().filter(x=>x.account===account());}
  function remember(save){
    const h=history(), data=P.portable(save), fingerprint=CryptoJS.SHA256(JSON.stringify(data.records)).toString(), a=account(save);
    const previous=h.filter(x=>x.account===a).at(-1);
    if(previous?.fingerprint===fingerprint)return;
    h.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),account:a,at:new Date().toISOString(),fingerprint,data});
    // Keep at most 12 snapshots per account and 36 across all accounts.
    const counts=new Map();const trimmed=h.reverse().filter(x=>{const n=(counts.get(x.account)||0)+1;counts.set(x.account,n);return n<=12;}).slice(0,36).reverse();
    writeStore(LS.history,trimmed);
  }
  function setSave(save,{snapshot=true,source=''}={}){
    S.save=save;S.ctx=P.context(save);S.source=source;S.page=1;
    writeStore(LS.cache,P.portable(save));if(snapshot)remember(save);
    $('#onboarding').hidden=true;$('#metrics').hidden=false;$('#workspace').hidden=false;
    updateProfile();render();
    if(save.unknown)toast(`${save.unknown} 条成绩缺少定数，已保留但不参与 RKS；可导入新版曲库。`);
  }
  function art(id){return window.PHI_ART?.[id]||'';}
  function artworkNote(){
    const total=PHI_DATA.songs.length,loaded=PHI_DATA.songs.filter(s=>art(s.id)).length;
    return loaded<total?` · 曲绘未完整加载（${loaded}/${total}），请上传完整 assets 目录后强制刷新`:'';
  }
  function updateProfile(){
    const save=S.save,stat=P.stats(save),b=P.board(save,30),top=b.phi[0]||b.best[0];
    const cover=top?art(top.id):'';
    if(cover)$('#hero').style.backgroundImage=`url("${cover}")`;
    $('#playerName').textContent=save.profile.name;$('#playerIntro').textContent=save.profile.intro||'每一道判定线，都是新的可能。';
    $('#sourceTag').textContent=save.demo?'DEMO / 演示数据':S.source==='历史快照'?'HISTORY / 历史快照':'LOCAL / 当前成绩';
    const [a,bdec]=S.ctx.rating.toFixed(4).split('.');$('#heroRks').innerHTML=`${a}<em>.${bdec}</em>`;
    $('#challenge').textContent=save.profile.challenge?'CHALLENGE '+save.profile.challenge:'';
    const cloud=save.profile.cloudRks;
    $('#cloudRks').textContent=cloud!=null?`云存档 RKS ${cloud.toFixed(4)}${Math.abs(cloud-S.ctx.rating)>.005?' · 当前定数重算值可能不同':''}`:'按当前曲库定数计算 · φ3 + Best 27';
    $('#syncTime').textContent='存档时间 / '+date(save.profile.updatedAt)+(save.demo?' · 以下均为模拟成绩':'');
    $('#connectText').textContent=save.demo?'连接真实存档':'管理存档';
    const meta=[['已玩谱面',stat.played,` / ${stat.total}`,'PLAYED','按当前曲库统计'],['FULL COMBO',stat.fc,'','V','包含所有 φ 成绩'],['ALL PERFECT',stat.phi,'','PHI','100 万分 · 100% ACC'],['B30 平均 ACC',(b.best.length?b.best.reduce((s,x)=>s+x.acc,0)/b.best.length:0).toFixed(2),'%','ACCURACY','Best 27 中已有成绩的均值']];
    $('#metrics').innerHTML=meta.map(([label,value,unit,code,note],i)=>`<div class="metric"><div class="metric-label">${esc(label)}<i class="${i===1?'full-combo':''}">${code}</i></div><strong class="${i===2?'gold':''}">${value}<span>${unit}</span></strong><p>${note}</p></div>`).join('');
    $('#dataNote').textContent=`曲库快照 ${PHI_DATA.date} · ${P.songs.size} 首曲目 · ${save.unknown?'部分未知定数未参与计算 · ':''}统计与图片在浏览器内生成${save.demo?' · 当前为演示数据':''}${artworkNote()}`;
  }
  function badge(r){return `<span class="level lv-${r.level}">${r.level}<small>${r.constant?.toFixed(1)||'?'}</small></span>`;}
  function card(r,i,{phi=false,overflow=false,hint=null}={}){
    if(!r)return `<div class="empty-slot"><b>${phi?'φ':'—'}</b><span>${phi?'等待你的下一个满分':'暂无成绩 · 按 0 计入'}</span></div>`;
    const song=P.songs.get(r.id),h=hint||P.suggest(S.ctx,r,S.gain),label=phi?'φ '+String(i+1).padStart(2,'0'):(overflow?'+':'#')+String(i+1).padStart(2,'0');
    return `<button class="score-card ${phi?'phi-card':''}" data-song="${esc(r.id)}" aria-label="${esc(song?.title||r.id)} ${r.level} 成绩详情">${art(r.id)?`<img class="cover" loading="lazy" src="${art(r.id)}" alt="">`:''}<div class="card-top"><span class="rank-no">${label}</span>${badge(r)}</div><div class="card-main"><h3 class="song-title">${esc(song?.title||r.id)}</h3><div class="song-artist">${esc(song?.artist||'未知曲目')}</div><div class="card-result"><strong class="score-number">${String(r.score).padStart(7,'0')}</strong><span class="card-grade ${r.grade==='φ'?'phi':r.fc?'fc':''}">${P.gradeLabel(r.grade)}</span></div><div class="card-stats"><span><small>ACC</small>${r.acc.toFixed(2)}%</span><span><small>RKS</small>${r.constant?r.rks.toFixed(4):'--'}</span></div></div><div class="card-hint"><span>${h?`目标 <b>${h.acc.toFixed(2)}%</b>`:r.grade==='φ'?'ALL PERFECT':r.constant?'暂无单曲推分方案':'定数待更新'}</span><span>${h?'RKS +'+h.gain.toFixed(4):r.grade==='φ'?'理论值已达成':'NEXT CHALLENGE'}</span></div></button>`;
  }
  const headings={best:['PERSONAL BEST','我的最佳成绩'],library:['CHART COLLECTION','单曲成绩查询'],stats:['PERFORMANCE ANALYSIS','我的节奏档案'],suggest:['YOUR NEXT CHALLENGE','下一次，突破自己'],history:['EVERY STEP COUNTS','记录你的每一次进步']};
  function render(){
    if(!S.save)return;
    document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===S.view));
    const h=headings[S.view];$('#viewEyebrow').textContent=h[0];$('#viewTitle').textContent=h[1];
    const functions={best:renderBest,library:renderLibrary,stats:renderStats,suggest:renderSuggest,history:renderHistory};functions[S.view]();
  }
  function renderBest(){
    const b=P.board(S.save,S.n),n=b.n;
    $('#content').innerHTML=`<div class="toolbar"><div class="segments">${[20,30,50].map(x=>`<button class="segment ${n===x?'active':''}" data-n="${x}">B${x}</button>`).join('')}<span class="control-label">自定义</span><input id="customN" class="custom-n" aria-label="自定义榜单数量" type="number" min="4" max="100" value="${n}"></div><div class="toolbar-note">${n===20?'旧制参考 · φ1 + Best 19':n===30?'现行规则 · φ3 + Best 27':`扩展展示 · φ3 + Best ${n-3}`}<br>所选榜单均值 <span class="accent">${b.average.toFixed(4)}</span></div></div>${n!==30?'<div class="notice">B20 为旧制参考；自定义榜单用于扩展展示。页面中的总 RKS 和推分建议始终按现行 B30 计算。</div>':''}<div class="subheading phi-heading"><h3>PHI <span>/ 满分位</span></h3><span>φ 成绩可同时计入 Best 位</span></div><div class="score-grid phi-grid">${Array.from({length:b.slots},(_,i)=>card(b.phi[i],i,{phi:true})).join('')}</div><div class="subheading"><h3>BEST ${n-b.slots}<span>/ 最佳表现</span></h3><span>按单曲 RKS 排序 · 点击查看详情</span></div><div class="score-grid">${Array.from({length:n-b.slots},(_,i)=>card(b.best[i],i)).join('')}</div>${b.overflow.length?`<div class="subheading"><h3>OVERFLOW <span>/ 候补成绩</span></h3><span>下一次进步，或许就在这里</span></div><div class="score-grid">${b.overflow.map((r,i)=>card(r,i,{overflow:true})).join('')}</div>`:''}`;
  }
  function filters(){return `<div class="filterbar"><div class="searchbox">${icon('search')}<input id="songSearch" placeholder="搜索曲名、曲师、谱师或曲目 ID…" aria-label="搜索曲目" value="${esc(S.query)}"></div><select id="levelFilter" aria-label="难度筛选"><option value="all">全部难度</option>${P.LEVELS.map(l=>`<option value="${l}" ${S.level===l?'selected':''}>${l}</option>`).join('')}</select><select id="gradeFilter" aria-label="评级筛选">${[['all','全部成绩'],['played','已游玩'],['unplayed','未游玩'],['φ','φ / All Perfect'],['FC','蓝色 V / Full Combo（含 φ）'],['V','白色 V / 960000+'],['S','S'],['A','A'],['B','B'],['C','C'],['F','F']].map(([v,t])=>`<option value="${v}" ${S.grade===v?'selected':''}>${t}</option>`).join('')}</select><select id="chapterFilter" aria-label="章节筛选"><option value="all">全部章节</option>${[...new Set([...P.songs.values()].map(s=>s.chapter||'其他曲目'))].map(c=>`<option ${S.chapter===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select><select id="sortFilter" aria-label="排序">${[['rks','RKS 从高到低'],['title','按曲名排序'],['constant','最高定数优先'],['acc','ACC 从高到低']].map(([v,t])=>`<option value="${v}" ${S.sort===v?'selected':''}>${t}</option>`).join('')}</select></div>`;}
  function filteredSongs(){
    const records=new Map(S.save.records.map(r=>[P.key(r),r]));
    const keywords=S.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return [...P.songs.values()].map(song=>{
      const rs=P.LEVELS.map(l=>records.get(song.id+'|'+l)).filter(Boolean).filter(r=>S.level==='all'||r.level===S.level);
      const lvs=S.level==='all'?song.constants:song.constants.slice(P.LEVELS.indexOf(S.level),P.LEVELS.indexOf(S.level)+1);
      return {song,rs,exists:lvs.some(Boolean),rks:Math.max(0,...rs.map(r=>r.rks)),acc:Math.max(0,...rs.map(r=>r.acc)),constant:Math.max(0,...lvs.filter(Boolean))};
    }).filter(({song,rs,exists})=>{
      if(!exists || (S.chapter!=='all'&&(song.chapter||'其他曲目')!==S.chapter))return false;
      const hay=[song.title,song.id,song.artist,...song.charters].join(' ').toLowerCase();
      if(!keywords.every(k=>hay.includes(k)))return false;
      if(S.grade==='played')return rs.some(r=>r.score>0||r.acc>0);
      if(S.grade==='unplayed')return !rs.some(r=>r.score>0||r.acc>0);
      if(S.grade==='FC')return rs.some(r=>r.fc);
      return S.grade==='all'||rs.some(r=>r.grade===S.grade);
    }).sort((a,b)=>S.sort==='title'?a.song.title.localeCompare(b.song.title):b[S.sort]-a[S.sort]||a.song.title.localeCompare(b.song.title));
  }
  function libraryResults(){
    const list=filteredSongs(),pages=Math.max(1,Math.ceil(list.length/24));S.page=Math.min(S.page,pages);
    return `<div class="results-note">找到 ${list.length} 首曲目 · ${S.level==='all'?'全部难度':S.level} · 点击曲绘查看各难度成绩</div><div class="library-grid">${list.slice((S.page-1)*24,S.page*24).map(({song,rs})=>`<button class="song-tile" data-song="${esc(song.id)}">${art(song.id)?`<img class="tile-art" loading="lazy" src="${art(song.id)}" alt="">`:'<div class="tile-art"></div>'}<div class="tile-info"><h3>${esc(song.title)}</h3><p>${esc(song.artist)}</p><div class="tile-levels">${song.constants.map((d,i)=>d?`<span class="level lv-${P.LEVELS[i]} ${rs.some(r=>r.level===P.LEVELS[i])?'':'unplayed'}">${P.LEVELS[i]} ${d.toFixed(1)}</span>`:'').join('')}</div></div></button>`).join('')}</div>${list.length?'':empty('没有匹配的曲目','试试其他关键词或筛选条件。')}<div class="pagination"><button class="btn small" data-page="${S.page-1}" ${S.page<=1?'disabled':''}>上一页</button><span>${S.page} / ${pages}</span><button class="btn small" data-page="${S.page+1}" ${S.page>=pages?'disabled':''}>下一页</button></div>`;
  }
  function renderLibrary(){$('#content').innerHTML=filters()+'<div id="libraryResults">'+libraryResults()+'</div>';}
  function empty(a,b){return `<div class="empty"><strong>${a}</strong>${b}</div>`;}
  function renderStats(){
    const st=P.stats(S.save),max=Math.max(1,...Object.values(st.grades)),all=P.board(S.save).all;
    $('#content').innerHTML=`<div class="stats-panels"><section class="panel"><h3>难度完成度<small>DIFFICULTY OVERVIEW</small></h3><div class="table-wrap"><table><thead><tr><th>难度</th><th>已玩 / 总数</th><th>通关</th><th><span class="full-combo" title="Full Combo（含 φ）">V</span></th><th>φ</th><th>平均 ACC</th></tr></thead><tbody>${st.levels.map(r=>`<tr><td><span class="level lv-${r.level}">${r.level}</span></td><td class="num">${r.played} / ${r.total}</td><td class="num">${r.clear}</td><td class="num">${r.fc}</td><td class="num">${r.phi}</td><td class="num">${r.acc.toFixed(2)}%</td></tr>`).join('')}</tbody></table></div><p class="recommendation">通关按分数 ≥ 700000 统计。蓝色 V 表示 Full Combo（包含 φ）；平均 ACC 仅计算已有成绩。</p></section><section class="panel"><h3>评级分布<small>RATING DISTRIBUTION</small></h3>${Object.entries(st.grades).map(([g,n])=>`<div class="stat-row"><strong class="${g==='FC'?'full-combo':''}" title="${g==='FC'?'Full Combo':g==='V'?'960000+，未全连':g}">${P.gradeLabel(g)}</strong><div class="bar"><i style="width:${n/max*100}%;background:${g==='φ'?'var(--accent)':g==='FC'?'var(--fc)':'#8294a9'}"></i></div><span>${n}</span></div>`).join('')}</section></div><section class="panel large-panel"><h3>RKS 构成<small>TOP 40 CHARTS</small></h3>${barChart(all.slice(0,40))}<div class="chart-foot"><span>最高单曲 ${all[0]?.rks.toFixed(4)||'--'}</span><span>第 27 名 ${all[26]?.rks.toFixed(4)||'--'}</span></div></section><div class="stats-panels large-panel"><section class="panel"><h3>更多记录<small>PERSONAL RECORDS</small></h3><table><tbody>${[['累计最佳分数',fmt(st.score)],['已玩曲目',new Set(S.save.records.filter(r=>r.score>0).map(r=>r.id)).size+' / '+P.songs.size],['已玩最高定数',Math.max(0,...all.map(r=>r.constant)).toFixed(1)],['满分最高定数',Math.max(0,...all.filter(r=>r.grade==='φ').map(r=>r.constant)).toFixed(1)],['课题模式记录',S.save.profile.challenge||'未提供'],['游戏存档版本',S.save.profile.gameVersion||'未提供'],...(S.save.profile.money?[['Data 原始分段',S.save.profile.money.join(' / ')]]:[])].map(([a,b])=>`<tr><td>${a}</td><td class="num">${esc(b)}</td></tr>`).join('')}</tbody></table></section><section class="panel"><h3>ACC 分布<small>ACCURACY PROFILE</small></h3>${[[100,'100%'],[99.5,'99.50% — 100%'],[99,'99% — 99.50%'],[98,'98% — 99%'],[95,'95% — 98%'],[0,'低于 95%']].map(([a,label],i,arr)=>{const upper=i?arr[i-1][0]:101,n=S.save.records.filter(r=>(r.score>0||r.acc>0)&&r.acc>=a&&r.acc<upper).length;return `<div class="stat-row"><span style="width:125px;text-align:left;font-size:12px;font-family:inherit">${label}</span><div class="bar"><i style="width:${100*n/Math.max(1,st.played)}%;background:var(--cyan)"></i></div><span>${n}</span></div>`;}).join('')}<div class="dialog-divider"></div><h3>等效 RKS 计算器</h3><div class="filterbar"><label class="control-label">定数 <input class="range-input" id="calcConstant" type="number" min="1" max="30" step=".1" value="15.0"></label><label class="control-label">ACC <input class="range-input" id="calcAcc" type="number" min="0" max="100" step=".01" value="99.00"></label><strong class="gain" id="calcResult">${P.rating(15,99).toFixed(4)}</strong></div><p class="recommendation">此处为单谱面 RKS；总体 RKS 还取决于榜单位次。</p></section></div><section class="panel large-panel"><h3>章节完成度<small>CHAPTER PROGRESS</small></h3><div class="table-wrap"><table><thead><tr><th>章节</th><th>已玩 / 总谱面</th><th>通关</th><th><span class="full-combo" title="Full Combo（含 φ）">V</span></th><th>φ</th><th>进度</th></tr></thead><tbody>${st.chapters.map(c=>`<tr><td class="chapter-label">${esc(c.chapter)}</td><td class="num">${c.played} / ${c.total}</td><td class="num">${c.clear}</td><td class="num">${c.fc}</td><td class="num">${c.phi}</td><td><div class="bar" style="width:100px"><i style="width:${Math.min(100,c.played/Math.max(1,c.total)*100)}%"></i></div></td></tr>`).join('')}</tbody></table></div></section><div class="notice">统计来自存档中的各谱面历史最佳成绩。存档不包含的游玩次数、游玩时长、单次游玩判定明细不会被推测生成。</div>`;
  }
  function barChart(rows){
    const w=1100,h=210,bw=(w-60)/Math.max(1,rows.length),max=Math.max(1,...rows.map(r=>r.rks));
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="最佳谱面 RKS 柱状图"><path d="M35 10V180H1090" stroke="#ffffff20" fill="none"/>${[5,10,15,20].filter(v=>v<=max+2).map(v=>`<text x="0" y="${180-v/max*150}" fill="#7e8c9e" font-size="11">${v}</text>`).join('')}${rows.map((r,i)=>{const ht=r.rks/max*155,x=45+i*bw;return `<rect x="${x}" y="${180-ht}" width="${Math.max(1,bw-5)}" height="${ht}" fill="${i<27?'#e9d78b':'#607b90'}"><title>${esc(P.songs.get(r.id)?.title||r.id)} ${r.level} / ${r.rks.toFixed(4)}</title></rect>${i%5===0?`<text x="${x}" y="202" fill="#7e8c9e" font-size="11">#${i+1}</text>`:''}`;}).join('')}</svg>`;
  }
  function renderSuggest(){
    const rows=S.save.records.filter(r=>(S.level==='all'||r.level===S.level)&&r.constant>=S.min&&r.constant<=S.max).map(r=>({r,h:P.suggest(S.ctx,r,S.gain)})).filter(x=>x.h).sort((a,b)=>a.h.delta-b.h.delta||a.h.acc-b.h.acc);
    $('#content').innerHTML=`<div class="suggest-head"><span>单曲让总 RKS 提升</span><select id="gainFilter">${[.001,.005,.01,.02,.05,.1].map(g=>`<option value="${g}" ${S.gain===g?'selected':''}>+${g.toFixed(3)}</option>`).join('')}</select><select id="suggestLevel"><option value="all">全部难度</option>${P.LEVELS.map(l=>`<option value="${l}" ${S.level===l?'selected':''}>${l}</option>`).join('')}</select><span>定数</span><input class="range-input" aria-label="最低定数" id="minConstant" type="number" min="0" max="30" step=".1" value="${S.min}"><span>—</span><input class="range-input" aria-label="最高定数" id="maxConstant" type="number" min="0" max="30" step=".1" value="${S.max}"></div><div class="notice">每张卡片表示独立更新该谱面后，总 RKS 至少提升 ${S.gain.toFixed(3)} 所需的 ACC。已计入 Best 位替换与 φ 位变化，目标向上取整到 0.01%；各卡片的提升不能直接相加。</div><div class="results-note">${rows.length} 个可行目标 · 按所需 ACC 增量排序 · 显示前 60 项</div><div class="score-grid">${rows.slice(0,60).map(({r,h},i)=>card(r,i,{hint:h})).join('')}</div>${rows.length?'':empty('暂时没有符合条件的方案','可以降低目标增量，或调整定数与难度。')}`;
  }
  function renderHistory(){
    const hs=snapshots(),selected=hs.find(x=>x.id===S.compareId)||hs[Math.max(0,hs.length-2)],current=new Map(S.save.records.map(r=>[P.key(r),r]));
    const old=selected?new Map(P.normalize(selected.data).records.map(r=>[P.key(r),r])):new Map();
    const changes=[...current.values()].map(r=>({r,old:old.get(P.key(r))})).filter(x=>!x.old||x.r.score>x.old.score||x.r.acc>x.old.acc||x.r.fc&&!x.old.fc).sort((a,b)=>(b.r.rks-(b.old?.rks||0))-(a.r.rks-(a.old?.rks||0)));
    $('#content').innerHTML=`<div class="history-actions"><span class="control-label">当前账号已保存 ${hs.length} / 12 份快照 · 相同成绩不重复记录</span><div><button class="btn small" id="backupHistory">备份全部历史</button> <button class="text-btn danger" id="clearHistory">清空当前账号历史</button></div></div>${hs.length?`<div class="history-grid"><section class="panel"><h3>同步时间线<small>SNAPSHOTS</small></h3>${[...hs].reverse().map(x=>`<div class="snapshot"><div><strong>${P.context(P.normalize(x.data)).rating.toFixed(4)}</strong><p>${date(x.at)}</p><p>${x.data.records.length} 条成绩${x.data.demo?' · 演示':''}</p></div><button class="btn small" data-snapshot="${esc(x.id)}">查看快照</button></div>`).join('')}</section><section class="panel"><h3>RKS 变化<small>PROGRESS</small></h3>${lineChart(hs)}<p class="recommendation">仅记录本浏览器成功载入的快照。曲库更新后，历史 RKS 会按当前定数重算。</p></section></div><section class="panel large-panel"><div class="history-actions"><h3>与快照比较</h3><select id="compareHistory" aria-label="选择比较快照">${[...hs].reverse().map(x=>`<option value="${esc(x.id)}" ${selected?.id===x.id?'selected':''}>${esc(date(x.at))}</option>`).join('')}</select></div>${changes.length?`<div class="table-wrap"><table><thead><tr><th>曲目</th><th>难度</th><th>原 ACC</th><th>当前 ACC</th><th>单曲 RKS 变化</th><th>分数</th></tr></thead><tbody>${changes.slice(0,100).map(({r,old:o})=>`<tr><td><button class="text-link" data-song="${esc(r.id)}">${esc(P.songs.get(r.id)?.title||r.id)}</button></td><td>${badge(r)}</td><td class="num">${o?o.acc.toFixed(2)+'%':'NEW'}</td><td class="num">${r.acc.toFixed(2)}%</td><td class="gain">+${(r.rks-(o?.rks||0)).toFixed(4)}</td><td class="num">${fmt(r.score)}</td></tr>`).join('')}</tbody></table></div>`:empty('当前没有成绩提升','完成新的同步后，在这里对比进步。')}</section>`:empty('从现在开始记录进步','成功导入或同步成绩后，会自动生成第一份本地快照。')}`;
  }
  function lineChart(hs){
    if(hs.length<2)return empty('已有第一份记录','下次同步有变化时，将生成趋势图。');
    const values=hs.map(x=>P.context(P.normalize(x.data)).rating),min=Math.min(...values)-.02,max=Math.max(...values)+.02,w=650,h=260;
    const pts=values.map((v,i)=>[48+i*(w-75)/(values.length-1),220-(v-min)/(max-min)*175]);
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="历史 RKS 趋势"><path d="M45 20V225H635" fill="none" stroke="#ffffff20"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" stroke="#e9d78b" stroke-width="2.5" fill="none"/>${pts.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="4" fill="#e9d78b"><title>${esc(date(hs[i].at))} / ${values[i].toFixed(4)}</title></circle>${i===0||i===pts.length-1?`<text x="${x}" y="${y-15}" fill="#d7d6c0" font-size="13" text-anchor="${i?'end':'start'}">${values[i].toFixed(4)}</text>`:''}`).join('')}<text x="48" y="250" font-size="11" fill="#8592a3">首次记录</text><text x="625" y="250" font-size="11" text-anchor="end" fill="#8592a3">最新记录</text></svg>`;
  }
  function showSong(id){
    const s=P.songs.get(id);if(!s){toast('该曲目尚未收录到当前曲库，成绩已保留。');return;}
    S.songId=id;
    $('#songContent').innerHTML=`<div class="song-banner">${art(id)?`<img src="${art(id)}" alt="">`:''}<button class="icon-btn" data-close aria-label="关闭">${icon('close')}</button><span class="eyebrow">SINGLE RECORD / 曲目详情</span><h2>${esc(s.title)}</h2><p>${esc(s.artist)}</p></div><div class="song-body"><div class="song-metadata"><span>${esc(s.chapter||'Phigros')}</span><span>BPM ${esc(s.bpm||'--')}</span><span>时长 ${esc(s.length||'--')}</span><span>曲绘 ${esc(s.illustrator)}</span></div>${P.LEVELS.map((lv,i)=>{const r=S.save.records.find(r=>r.id===id&&r.level===lv),h=r?P.suggest(S.ctx,r,S.gain):null;return `<div class="song-level"><span class="level lv-${lv}">${lv} ${s.constants[i]?.toFixed(1)||'--'}</span><div><strong class="score-number">${r?String(r.score).padStart(7,'0'):'--'}</strong><p>${r?'ACC '+r.acc.toFixed(4)+'%':s.constants[i]?'尚未游玩':'无此难度'}</p></div><div><strong class="rks">${r?.constant?r.rks.toFixed(4):'--'}</strong><p>RKS</p></div><span class="card-grade ${r?.grade==='φ'?'phi':r?.fc?'fc':''}">${P.gradeLabel(r?.grade)||''}</span>${r?`<div class="hint">${h?`推分目标 ${h.acc.toFixed(2)}% → 总 RKS +${h.gain.toFixed(4)}`:r.grade==='φ'?'ALL PERFECT · 已达理论值':'暂无单曲目标方案'}</div>`:''}<p style="grid-column:2/-1">谱师 ${esc(s.charters[i]||'--')}</p></div>`;}).join('')}<div class="song-bottom"><button class="btn" data-close>关闭</button><button class="btn primary" id="exportSong">${icon('download')}导出单曲成绩图</button></div></div>`;
    $('#songDialog').showModal();
  }
  function openConnect(){
    $('#token').value=tokenMemory||readStore(LS.token,'')||'';$('#rememberToken').checked=!!readStore(LS.token,'');$('#connectStatus').textContent='';$('#downloadFallback').hidden=true;$('#connectDialog').showModal();
  }
  async function connect(e){
    e.preventDefault();const t=$('#token').value.trim();if(!/^[a-zA-Z0-9]{25}$/.test(t)){toast('请输入 25 位 sessionToken。');return;}
    $('#submitConnect').disabled=true;$('#diagnoseBtn').disabled=true;$('#connectStatus').classList.remove('error');$('#downloadFallback').hidden=true;
    try{
      const save=await P.cloud(t,s=>$('#connectStatus').textContent=s,url=>{$('#saveDownload').href=url;$('#downloadFallback').hidden=false;});
      tokenMemory=t;if($('#rememberToken').checked)writeStore(LS.token,t);else removeStore(LS.token);
      setSave(save,{source:'云存档'});$('#connectDialog').close();toast('云存档已读取，成绩与统计已更新。');
    }catch(err){$('#connectStatus').textContent=(err.code?'['+err.code+'] ':'')+err.message;$('#connectStatus').classList.add('error');}
    finally{$('#submitConnect').disabled=false;$('#diagnoseBtn').disabled=false;}
  }
  let connectionReport=null;
  async function diagnoseConnection(){
    $('#diagnoseBtn').disabled=true;$('#submitConnect').disabled=true;$('#saveDiagnosis').hidden=true;$('#diagnoseResult').hidden=false;
    $('#diagnoseResult').textContent='正在检测浏览器与官方接口的连接，不读取输入框或已保存的 token…';
    try{
      const r=await P.diagnoseCloud();
      connectionReport=['Phi Prism 连接诊断 '+r.version,'结果 ['+r.code+']：'+r.result,'打开方式：'+r.protocol,'浏览器：'+r.browser,
        '联网状态：'+r.online,'安全上下文：'+r.secureContext,'Fetch：'+r.fetch,'AbortController：'+r.abortController,'原生超时 API：'+r.nativeTimeout,
        '耗时：'+r.elapsedMs+' ms','本报告不包含你的 sessionToken、玩家资料或成绩。',
        r.code==='NETWORK'?'浏览器未提供具体网络原因。请按 F12 → Console，点击“连接诊断”后查看红色错误；只截错误文字，勿截请求头。':''].filter(Boolean).join('\n');
      $('#diagnoseResult').textContent=connectionReport;$('#saveDiagnosis').hidden=false;
    }catch{connectionReport=null;$('#diagnoseResult').textContent='诊断未能完成，请在新版浏览器中打开后重试。';}
    finally{$('#diagnoseBtn').disabled=false;$('#submitConnect').disabled=false;}
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function downloadJSON(obj,name){downloadBlob(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),name);}
  const stamp=()=>new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);
  async function importFile(file){
    if(!file)return;if(file.size>12*1024*1024){toast('文件超过 12 MB，请选择原始存档或成绩 JSON。');return;}
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());let save;
      if(bytes[0]===80&&bytes[1]===75)save=P.parseZip(bytes);
      else{
        const j=JSON.parse(new TextDecoder().decode(bytes));
        if(j.schema==='phi-prism-backup/1'){
          if(!Array.isArray(j.snapshots)||j.snapshots.length>36)throw Error('备份的历史快照数量不正确。');
          const current=P.normalize(j.current),hs=j.snapshots.map(x=>{const data=P.portable(P.normalize(x.data));return {id:String(x.id).slice(0,80),at:P.normalize(x.data).importedAt,account:account(data),fingerprint:CryptoJS.SHA256(JSON.stringify(data.records)).toString(),data,...(Number.isFinite(+new Date(x.at))?{at:new Date(x.at).toISOString()}:{})};});
          // Restore only a complete, validated backup; token fields are never read or persisted.
          writeStore(LS.history,hs);save=current;
        }else save=P.normalize(j);
      }
      tokenMemory='';S.view='best';setSave(save,{source:'本地导入'});document.querySelectorAll('dialog[open]').forEach(d=>d.close());toast(`成功导入 ${save.records.length} 条成绩。`);
    }catch(err){toast('导入失败：'+(err instanceof SyntaxError?'JSON 格式不正确。':err.message));}
    finally{$('#importFile').value='';}
  }
  function exportOptions(){return {type:$('#exportType').value,n:S.n,songId:S.songId,gain:S.gain,layout:$('#exportLayout').value,scale:Number($('#exportScale').value),color:$('#exportColor').value,brightness:Number($('#exportBrightness').value),background:$('#exportBackground').value,customBackground:S.customBackground,customAvatar:S.customAvatar,identity:$('#exportIdentity').checked,hints:$('#exportHints').checked,overflow:$('#exportOverflow').checked,watermark:$('#exportWatermark').checked,name:$('#exportName').value.trim(),signature:$('#exportSignature').value.trim()};}
  async function renderPreview(){
    if(!S.save)return;const id=++S.renderId;S.canvas=null;$('#renderBtn').disabled=true;$('#downloadImage').disabled=true;$('#copyImage').disabled=true;$('#exportStatus').textContent='正在排版与绘制…';
    try{const canvas=await PhiRender.make(S.save,exportOptions());if(id!==S.renderId)return;S.canvas=canvas;$('#canvasWrap').replaceChildren(canvas);$('#imageSize').textContent=`${canvas.width} × ${canvas.height} PX`;$('#exportStatus').textContent=canvas.dataset.adjusted==='true'?'已根据画布尺寸限制调整输出倍率。':'图片已生成，包含当前选择的内容。';$('#downloadImage').disabled=false;$('#copyImage').disabled=false;}
    catch(err){if(id===S.renderId)$('#exportStatus').textContent='生成失败：'+err.message;}
    finally{if(id===S.renderId)$('#renderBtn').disabled=false;}
  }
  function openExport(type){
    if(!S.save){openConnect();return;}
    const options=[...P.songs.values()];$('#exportBackground').innerHTML='<option value="">自动 · 最佳成绩曲绘</option>'+options.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
    $('#exportType').value=type||({stats:'stats',suggest:'suggest'}[S.view]||'best');
    if($('#exportType').value==='song'&&!S.songId)$('#exportType').value='best';
    $('#exportDialog').showModal();renderPreview();
  }
  function getCanvasBlob(type){return new Promise((resolve,reject)=>{if(!S.canvas){reject(Error('请先生成图片。'));return;}try{S.canvas.toBlob(b=>b?resolve(b):reject(Error('图片编码失败，请降低分辨率。')),type,.94);}catch(e){reject(e);}});}
  async function downloadImage(){try{const ext=$('#exportFormat').value,blob=await getCanvasBlob('image/'+ext),base=$('#exportFilename').value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-')||`phi-prism-${$('#exportType').value==='best'?'b'+S.n:$('#exportType').value}-${stamp()}`;downloadBlob(blob,base.replace(/\.(png|jpg|jpeg)$/i,'')+'.'+(ext==='jpeg'?'jpg':'png'));toast('图片已导出。');}catch(e){toast(e.message);}}
  async function copyImage(){try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('当前浏览器不支持复制图片，请使用下载图片。');await navigator.clipboard.write([new ClipboardItem({'image/png':await getCanvasBlob('image/png')})]);toast('图片已复制。');}catch(e){toast('复制失败：'+e.message);}}
  function customImage(file,type){if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){toast('请选择不超过 8 MB 的 PNG、JPG 或 WebP。');return;}const reader=new FileReader();reader.onload=async()=>{const i=await PhiRender.image(reader.result);if(!i||i.width>8192||i.height>8192){toast('图片无效或尺寸超过 8192 像素。');return;}if(type==='background')S.customBackground=reader.result;else S.customAvatar=reader.result;renderPreview();toast(type==='background'?'已应用自定义背景。':'已应用自定义头像。');};reader.readAsDataURL(file);}
  function showHelp(){
    $('#helpContent').innerHTML=`<p>Phi Prism 是纯静态的 Phigros 查分与出图工具。无需构建，无需后端，可放在 GitHub Pages，也可直接打开 <code>index.html</code>。</p><h3>读取成绩</h3><ul><li>sessionToken 只发送给游戏云存档域名；默认仅本次使用，勾选后才保存到此浏览器。</li><li>本地支持原始云存档 ZIP、本站成绩 JSON，以及含 gameRecord 的兼容 JSON。</li><li>若下载域名阻止跨域，页面会提供原始存档下载链接，保存后再导入即可。</li><li>导出 JSON 和备份不会包含 token。数据只保存在当前浏览器；清理浏览器会删除本地记录。</li></ul><h3>RKS 与榜单</h3><p>单谱面 ACC &lt; 70% 时 RKS 为 0；否则为定数 × ((ACC − 55) / 45)²。现行 B30 =（最高 3 个满分位 + 最高 27 个 Best 位）÷ 30；同一 φ 谱面可以同时占两类槽位，缺位按 0 计算。</p><p>B20 按旧制 φ1 + Best 19 展示；其他 Best N 使用 φ3 + Best (N−3)，仅作扩展参考。总 RKS 与推分提示始终按 B30 计算。推分建议计算独立更新单谱面后总体提升所需 ACC，向上取整至 0.01%。定数更新可能造成重算值与云存档摘要不同。</p><h3>历史与导出</h3><p>每个账号最多保留 12 份不同成绩快照，总计最多 36 份。历史趋势仅来自实际载入的数据。图片支持 Best N、单曲、统计和推分计划，提供横竖版、高清 PNG/JPG、自定义背景头像与签名。长图会自动调整倍率以适应浏览器画布限制。</p><h3>曲库与素材</h3><p>当前曲库快照 ${PHI_DATA.date}，共 ${P.songs.size} 首。元数据与协议参考 <a href="https://github.com/Catrong/phi-plugin" target="_blank" rel="noopener noreferrer">Catrong/phi-plugin</a>；曲绘来自 <a href="https://github.com/Catrong/phi-plugin-ill" target="_blank" rel="noopener noreferrer">phi-plugin-ill</a>。代码按 GPL-3.0-or-later 提供；曲绘、游戏名称等素材版权归各自权利人。本工具与 Pigeon Games、TapTap 无隶属关系。</p><p>包内 <code>tools/update_data.py</code> 可更新曲库及内嵌曲绘；也可在此 <button class="text-link" id="importCatalog">导入曲库 JSON</button>。未知谱面成绩会保留，定数缺失时不计入 RKS。</p><div class="dialog-divider"></div><button class="btn danger" id="clearCurrent">清除当前成绩缓存</button><p>此操作只清除当前展示与缓存；历史可在“同步历史”中分别清除。</p>`;
    $('#helpDialog').showModal();
  }
  $('#connectForm').addEventListener('submit',connect);
  $('#diagnoseBtn').onclick=diagnoseConnection;
  $('#saveDiagnosis').onclick=()=>connectionReport&&downloadBlob(new Blob([connectionReport],{type:'text/plain;charset=utf-8'}),'phi-prism-connection.txt');
  for(const id of ['connectBtn','startConnect'])$('#'+id).onclick=openConnect;
  for(const id of ['startImport','importBtn','dialogImport','fallbackImport'])$('#'+id).onclick=()=>$('#importFile').click();
  $('#syncBtn').onclick=()=>{openConnect();if(tokenMemory||readStore(LS.token,''))$('#connectForm').requestSubmit();};
  $('#toggleToken').onclick=()=>{const i=$('#token');i.type=i.type==='password'?'text':'password';$('#toggleToken').textContent=i.type==='password'?'显示':'隐藏';};
  $('#forgetBtn').onclick=()=>{tokenMemory='';removeStore(LS.token);$('#token').value='';$('#rememberToken').checked=false;$('#downloadFallback').hidden=true;$('#saveDownload').removeAttribute('href');toast('已清除本浏览器保存的 token。');};
  $('#demoBtn').onclick=()=>{S.view='best';setSave(P.demo(),{source:'演示'});toast('已载入演示成绩；可直接体验所有统计和出图功能。');};
  $('#importFile').onchange=e=>importFile(e.target.files[0]);
  $('#jsonBtn').onclick=()=>S.save&&downloadJSON(P.portable(S.save),'phi-prism-scores-'+stamp()+'.json');
  for(const id of ['heroExport','exportBtn'])$('#'+id).onclick=()=>openExport();
  for(const id of ['helpBtn','aboutBtn'])$('#'+id).onclick=showHelp;
  $('#exportForm').onsubmit=e=>{e.preventDefault();renderPreview();};
  $('#exportForm').addEventListener('input',()=>{S.canvas=null;$('#downloadImage').disabled=true;$('#copyImage').disabled=true;clearTimeout(previewTimer);previewTimer=setTimeout(renderPreview,350);});
  $('#downloadImage').onclick=downloadImage;$('#copyImage').onclick=copyImage;
  $('#customBgBtn').onclick=()=>$('#backgroundFile').click();$('#backgroundFile').onchange=e=>customImage(e.target.files[0],'background');
  $('#customAvatarBtn').onclick=()=>$('#avatarFile').click();$('#avatarFile').onchange=e=>customImage(e.target.files[0],'avatar');
  $('#exportBackground').onchange=()=>{S.customBackground='';};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b)return;
    if(b.matches('[data-close]')){b.closest('dialog')?.close();return;}
    if(b.dataset.view){if(!S.save){toast('请先连接存档，或体验演示成绩。');return;}S.view=b.dataset.view;S.page=1;render();return;}
    if(b.dataset.n){S.n=Number(b.dataset.n);renderBest();return;}
    if(b.dataset.song){showSong(b.dataset.song);return;}
    if(b.dataset.page){S.page=Number(b.dataset.page);$('#libraryResults').innerHTML=libraryResults();$('#workspace').scrollIntoView({block:'start'});return;}
    if(b.dataset.snapshot){const x=history().find(x=>x.id===b.dataset.snapshot);if(x)setSave(P.normalize(x.data),{snapshot:false,source:'历史快照'});toast('已载入历史快照。');return;}
    if(b.id==='exportSong'){$('#songDialog').close();openExport('song');return;}
    if(b.id==='backupHistory'){downloadJSON({schema:'phi-prism-backup/1',current:P.portable(S.save),snapshots:history()},'phi-prism-backup-'+stamp()+'.json');return;}
    if(b.id==='clearHistory'){if(confirm('清空当前账号的本地历史？建议先备份。')){writeStore(LS.history,history().filter(x=>x.account!==account()));renderHistory();toast('当前账号的历史已清空。');}return;}
    if(b.id==='clearCurrent'){removeStore(LS.cache);location.reload();return;}
    if(b.id==='importCatalog'){
      const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>3*1024*1024)throw Error('曲库文件过大。');const j=JSON.parse(await f.text());if(!Array.isArray(j.songs)||j.songs.length>3000)throw Error('缺少 songs 数组。');for(const s of j.songs){if(!s.id||!Array.isArray(s.constants)||s.constants.length!==4||!s.constants.every(v=>v===null||Number.isFinite(v)&&v>0&&v<30))throw Error('曲库定数格式不正确。');}const clean=j.songs.map(s=>({id:String(s.id).slice(0,240),title:String(s.title||s.id).slice(0,240),artist:String(s.artist||'').slice(0,240),illustrator:String(s.illustrator||'').slice(0,240),chapter:String(s.chapter||'其他曲目').slice(0,100),charters:Array.isArray(s.charters)?s.charters.slice(0,4).map(String):['','','',''],constants:s.constants,bpm:String(s.bpm||''),length:String(s.length||'')}));P.songs.clear();clean.forEach(s=>P.songs.set(s.id,s));PHI_DATA.songs=clean;PHI_DATA.date=String(j.date||'自定义快照').slice(0,40);if(S.save)setSave(P.normalize(P.portable(S.save)),{snapshot:false});$('#helpDialog').close();toast('已加载曲库，本次会话有效；部署时请更新 assets/data.js。');}catch(err){toast('曲库导入失败：'+err.message);}};input.click();
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='customN'){
      const value=Number(e.target.value);clearTimeout(bestTimer);
      if(Number.isFinite(value)&&value>=4){S.n=Math.max(4,Math.min(100,Math.round(value)));bestTimer=setTimeout(()=>{if(S.view==='best')renderBest();},450);}
    }
    if(e.target.id==='songSearch'){S.query=e.target.value;S.page=1;$('#libraryResults').innerHTML=libraryResults();}
    if(['calcConstant','calcAcc'].includes(e.target.id)){const d=Number($('#calcConstant').value),a=Number($('#calcAcc').value);$('#calcResult').textContent=d>0&&d<30&&a>=0&&a<=100?P.rating(d,a).toFixed(4):'--';}
  });
  document.addEventListener('change',e=>{
    const id=e.target.id,v=e.target.value;
    if(id==='customN'){clearTimeout(bestTimer);S.n=Math.max(4,Math.min(100,Math.round(Number(v)||30)));renderBest();}
    const f={levelFilter:'level',gradeFilter:'grade',chapterFilter:'chapter',sortFilter:'sort'};
    if(f[id]){S[f[id]]=v;S.page=1;$('#libraryResults').innerHTML=libraryResults();}
    if(id==='gainFilter'){S.gain=Number(v);renderSuggest();}if(id==='suggestLevel'){S.level=v;renderSuggest();}
    if(id==='minConstant'||id==='maxConstant'){S.min=Math.max(0,Math.min(30,Number($('#minConstant').value)||0));S.max=Math.max(S.min,Math.min(30,Number($('#maxConstant').value)||30));renderSuggest();}
    if(id==='compareHistory'){S.compareId=v;renderHistory();}
  });
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  let dragCount=0;
  window.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragCount++;document.body.classList.add('drop-active');}});
  window.addEventListener('dragleave',()=>{if(--dragCount<=0){dragCount=0;document.body.classList.remove('drop-active');}});
  window.addEventListener('dragover',e=>e.preventDefault());
  window.addEventListener('drop',e=>{e.preventDefault();dragCount=0;document.body.classList.remove('drop-active');importFile(e.dataTransfer?.files[0]);});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!document.querySelector('dialog[open]')&&S.save){e.preventDefault();S.view='library';render();$('#songSearch').focus();}});
  const cached=readStore(LS.cache);if(cached){try{setSave(P.normalize(cached),{snapshot:false,source:'缓存'});}catch{removeStore(LS.cache);}}
  if(!S.save){const hero=[...P.songs.values()].find(s=>s.title==='Rrhar’il')||[...P.songs.values()].find(s=>s.title.includes('Distorted Fate'))||[...P.songs.values()].at(-1);if(hero)$('#hero').style.backgroundImage=`url("${art(hero.id)}")`;$('#dataNote').textContent=`曲库快照 ${PHI_DATA.date} · ${P.songs.size} 首曲目 · 素材已内置，可离线出图${artworkNote()}`;}
  // Expose state only for local diagnostics; it never contains persisted token fields.
  window.PhiPrism={getSave:()=>S.save,getView:()=>S.view};
})();

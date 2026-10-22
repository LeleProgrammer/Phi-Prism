/* Canvas composition. All artwork is bundled as data URLs, also safe on file://. */
(function (root) {
  'use strict';
  const P = root.Phi, colors = {EZ: '#82c98c', HD: '#8abbe6', IN: '#d880a4', AT: '#b8bdc7'};
  const imageCache = new Map();
  const art = id => root.PHI_ART?.[id] || '';
  async function image(src) {
    if (!src) return null;
    if (!imageCache.has(src)) imageCache.set(src, new Promise(resolve => {const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src;}));
    return imageCache.get(src);
  }
  function polygon(c, x, y, w, h, cut = 13) {c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - cut); c.lineTo(x + w - cut, y + h); c.lineTo(x, y + h); c.closePath();}
  function cover(c, img, x, y, w, h, alpha = 1) {
    if (!img) return;
    const scale = Math.max(w / img.width, h / img.height), sw = w / scale, sh = h / scale;
    c.save(); c.globalAlpha = alpha; c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); c.restore();
  }
  function text(c, value, x, y, size, color = '#f5f5f1', options = {}) {
    c.fillStyle = color; c.textAlign = options.align || 'left'; c.textBaseline = 'alphabetic';
    c.font = `${options.weight || 500} ${size}px ${options.numeric && /^[\x00-\x7f]*$/.test(String(value)) ? 'Barlow, PhiSans, sans-serif' : '"PhiSans", "Microsoft YaHei", "PingFang SC", sans-serif'}`;
    let s = String(value);
    if (options.width) {
      const chars = Array.from(s);
      while (chars.length && c.measureText(chars.join('') + '…').width > options.width && c.measureText(s).width > options.width) {chars.pop(); s = chars.join('') + '…';}
    }
    c.fillText(s, x, y);
  }
  function line(c, x, y, w, color = '#ffffff24') {c.fillStyle = color; c.fillRect(x, y, w, 1);}
  function pill(c, s, x, y, fill, w = 62) {c.fillStyle = fill; c.beginPath();c.moveTo(x + 6, y);c.lineTo(x + w, y);c.lineTo(x + w - 6, y + 26);c.lineTo(x, y + 26);c.closePath();c.fill();text(c, s, x + w / 2, y + 19, 17, '#111820', {align: 'center', numeric: true});}
  function card(c, r, x, y, w, h, number, opts, ctx, imgs, forcedHint) {
    if (!r) {const phi=number.startsWith('φ');c.fillStyle = '#ffffff05';polygon(c, x,y,w,h);c.fill();c.strokeStyle = '#f1df8b35';c.stroke();text(c,phi?'φ':'—',x+w/2,y+h/2,53,'#f1df8b50',{align:'center'});text(c,phi?'尚无满分成绩':'暂无成绩 · 缺位按 0 计算',x+w/2,y+h/2+34,15,'#8a929f',{align:'center'});return;}
    const s = P.songs.get(r.id), pad = 18;
    c.save();polygon(c,x,y,w,h);c.clip();c.fillStyle='#26313d';c.fillRect(x,y,w,h);cover(c,imgs.get(r.id),x,y,w,h,0.75);
    let g=c.createLinearGradient(x,y,x+w,y);g.addColorStop(0,'#0b121bbf');g.addColorStop(1,'#0b121b42');c.fillStyle=g;c.fillRect(x,y,w,h);
    g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#0b101a22');g.addColorStop(.4,'#0b101a66');g.addColorStop(1,'#0b101af5');c.fillStyle=g;c.fillRect(x,y,w,h);
    text(c,number,x+pad,y+27,21,number.startsWith('φ')?opts.color:'#d5dce5',{numeric:true});
    pill(c,`${r.level} ${r.constant?.toFixed(1) || '?'}`,x+w-97,y+10,colors[r.level],82);
    text(c,s?.title || r.id,x+pad,y+63,20,'#ffffff',{width:w-pad*2,weight:600});
    text(c,s?.artist || '未知曲目',x+pad,y+83,11,'#c1c8d2',{width:w-70});
    text(c,String(r.score).padStart(7,'0'),x+pad,y+132,47,'#ffffff',{numeric:true});
    text(c,P.gradeLabel(r.grade),x+w-pad,y+130,r.grade==='φ'?43:39,r.grade==='φ'?opts.color:r.fc?'#66ccff':'#e1e5ed',{align:'right',numeric:r.grade!=='φ'});
    text(c,'ACC',x+pad,y+157,10,'#8e9eae');text(c,r.acc.toFixed(2)+'%',x+pad+34,y+157,21,'#e1e6ed',{numeric:true});
    text(c,'RKS',x+w-pad-83,y+157,10,'#8e9eae');text(c,r.constant?r.rks.toFixed(4):'--',x+w-pad,y+157,21,'#e1e6ed',{numeric:true,align:'right'});
    if(opts.hints){
      line(c,x+pad,y+h-32,w-pad*2,'#ffffff24');
      const hint=forcedHint || P.suggest(ctx,r,opts.gain || .01);
      text(c,hint?'目标 ACC '+hint.acc.toFixed(2)+'%':r.grade==='φ'?'ALL PERFECT':r.constant?'已达目标 / 暂无单曲方案':'定数待更新',x+pad,y+h-11,11,hint?opts.color:'#aeb7c4');
      if(hint)text(c,'RKS +'+hint.gain.toFixed(4),x+w-pad,y+h-11,16,'#8fd3df',{align:'right',numeric:true});
    }
    c.restore();c.strokeStyle=number.startsWith('φ')?opts.color+'88':'#ffffff28';polygon(c,x,y,w,h);c.stroke();
  }
  function title(c,a,b,x,y,width,color){text(c,a,x,y,25,color,{numeric:true});text(c,b,x+width,y,12,'#9aa4b1',{align:'right'});line(c,x,y+14,width);}
  async function make(save, options = {}) {
    const o = {type:'best',n:30,layout:'portrait',scale:1.5,color:'#f1df8b',brightness:20,identity:true,hints:true,overflow:true,watermark:true,gain:.01,...options};
    try {await document.fonts.load('600 40px Barlow');await document.fonts.load('500 20px PhiSans');await document.fonts.ready;} catch {}
    const width = o.layout==='landscape'?2200:1440, margin=58, gap=18, cols=o.layout==='landscape'?5:3;
    const cw=(width-margin*2-gap*(cols-1))/cols, ch=202, ctx=P.context(save), b=P.board(save,o.n), stat=P.stats(save);
    let song = o.songId ? P.songs.get(o.songId) : null;
    if(o.type==='song' && !song)throw Error('请先在单曲查询中选择一首曲目。');
    let groups=[],height=0;
    if(o.type==='best'){
      groups.push({title:`PHI / ${b.slots}`,caption:`满分位 · ${b.slots} 个独立槽位`,list:Array.from({length:b.slots},(_,i)=>b.phi[i]),prefix:'φ'});
      groups.push({title:`BEST / ${b.n-b.slots}`,caption:`所选榜单均值 ${b.average.toFixed(4)} · 缺位按 0 计算`,list:Array.from({length:b.n-b.slots},(_,i)=>b.best[i]),prefix:'#'});
      if(o.overflow && b.overflow.length)groups.push({title:'OVERFLOW / '+b.overflow.length,caption:'候补成绩 · 不计入所选榜单',list:b.overflow,prefix:'+'});
    }else if(o.type==='suggest'){
      const rows=save.records.map(r=>({r,h:P.suggest(ctx,r,o.gain)})).filter(x=>x.h).sort((a,b)=>a.h.delta-b.h.delta).slice(0,30);
      groups.push({title:'NEXT / +'+o.gain.toFixed(3),caption:'每个建议独立替换一首成绩 · 按所需 ACC 增量排序',list:rows.map(x=>x.r),prefix:'#',hints:rows.map(x=>x.h)});
    }
    height=o.type==='stats'?1350:o.type==='song'?1080:430+groups.reduce((s,g)=>s+68+Math.max(1,Math.ceil(g.list.length/cols))*(ch+gap),0)+105;
    const requestedScale=Number(o.scale)||1, scale=Math.min(requestedScale,Math.sqrt(14000000/(width*height)),8192/height,8192/width);
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const c=canvas.getContext('2d');if(!c)throw Error('浏览器无法创建画布，请降低分辨率。');c.scale(scale,scale);
    const records=groups.flatMap(g=>g.list).filter(Boolean);
    if(song)records.push({id:song.id});
    const bgId=o.background || song?.id || b.phi[0]?.id || b.best[0]?.id || [...P.songs.keys()][0];
    const sources=new Set(records.map(r=>r.id));sources.add(bgId);
    const imgs=new Map(await Promise.all([...sources].map(async id=>[id,await image(art(id))])));
    const bg=o.customBackground?await image(o.customBackground):imgs.get(bgId);
    c.fillStyle='#10151d';c.fillRect(0,0,width,height);
    cover(c,bg,0,0,width,height,Math.min(.45,Number(o.brightness)/100));
    let g=c.createLinearGradient(0,0,0,height);g.addColorStop(0,'#10151d00');g.addColorStop(.5,'#10151d66');g.addColorStop(1,'#10151dbb');c.fillStyle=g;c.fillRect(0,0,width,height);
    c.strokeStyle='#ffffff12';c.lineWidth=1;for(let x=width*.58;x<width*1.4;x+=150){c.beginPath();c.moveTo(x,0);c.lineTo(x-height*.28,height);c.stroke();}
    c.fillStyle=o.color;c.fillRect(margin,47,5,23);
    text(c,o.watermark?'PHI PRISM':'PHIGROS RECORD',margin+18,66,24,'#eef0f3',{numeric:true});
    text(c,save.demo?'DEMO / 演示成绩':o.type==='stats'?'PLAYER STATISTICS':o.type==='song'?'SINGLE RECORD':o.type==='suggest'?'RATING ROADMAP':`BEST ${b.n} / ${b.slots}φ + ${b.n-b.slots} BEST`,width-margin,64,20,o.color,{align:'right',numeric:true});
    line(c,margin,88,width-margin*2,'#ffffff25');
    const playerName=o.identity?(o.name || save.profile.name):'PHIGROS PLAYER';
    const avatar=o.identity&&o.customAvatar?await image(o.customAvatar):null;
    const ax=margin,ay=120;
    c.save();polygon(c,ax,ay,90,90,14);c.clip();c.fillStyle=o.color+'14';c.fillRect(ax,ay,90,90);
    if(avatar)cover(c,avatar,ax,ay,90,90);else text(c,'φ',ax+45,ay+65,64,o.color,{align:'center'});c.restore();
    text(c,playerName,margin+112,155,31,'#f7f7f5',{width:width-600,weight:600});
    text(c,o.signature || (o.identity?save.profile.intro:'') || '每一道判定线，都是新的可能。',margin+112,187,14,'#b4becd',{width:width-600});
    text(c,'RANKING SCORE / B30',width-margin,133,16,'#aeb9c8',{align:'right',numeric:true});
    text(c,ctx.rating.toFixed(4),width-margin,204,80,o.color,{align:'right',numeric:true});
    const date=save.profile.updatedAt?new Date(save.profile.updatedAt).toLocaleString('zh-CN',{hour12:false}):'本地导入';
    text(c,'SAVE / '+date,margin,245,13,'#9ca8b8');
    if(o.identity && save.profile.challenge)text(c,'CHALLENGE / '+save.profile.challenge,margin+width*.45,245,17,'#aab6c7',{numeric:true});
    const metricY=274,mw=(width-margin*2)/4;
    const metrics=[['PLAYED',stat.played+' / '+stat.total],['FULL COMBO',String(stat.fc)],['ALL PERFECT',String(stat.phi)],['TOTAL SCORE',stat.score.toLocaleString('en-US')]];
    metrics.forEach(([label,value],i)=>{const x=margin+mw*i;c.fillStyle='#0b111a7a';c.fillRect(x,metricY,mw-2,78);text(c,label,x+17,metricY+22,13,'#92a0b3',{numeric:true});text(c,value,x+17,metricY+61,i===3?29:34,i===2?o.color:'#edf1f5',{numeric:true});});
    let y=410;
    if(o.type==='best' || o.type==='suggest') {
      for(const group of groups){title(c,group.title,group.caption,margin,y,width-margin*2,o.color);y+=34;
        if(!group.list.length){text(c,'暂无符合条件的成绩或推分方案',margin,y+65,22,'#9ca8b8');y+=ch+gap;}
        group.list.forEach((r,i)=>{const x=margin+(i%cols)*(cw+gap),cy=y+Math.floor(i/cols)*(ch+gap);card(c,r,x,cy,cw,ch,group.prefix+String(i+1).padStart(2,'0'),o,ctx,imgs,group.hints?.[i]);});
        if(group.list.length)y+=Math.ceil(group.list.length/cols)*(ch+gap);y+=34;
      }
    } else if(o.type==='song') {
      title(c,'SINGLE / '+song.title,song.artist,margin,410,width-margin*2,o.color);
      text(c,`${song.chapter || 'Phigros'}    BPM ${song.bpm || '--'}    ${song.length || ''}`,margin,465,16,'#aeb8c6',{width:width-margin*2});
      P.LEVELS.forEach((lv,i)=>{const cy=497+i*112;const r=save.records.find(x=>x.id===song.id && x.level===lv);const constant=song.constants[i];
        c.fillStyle='#0b111aa8';polygon(c,margin,cy,width-margin*2,98);c.fill();pill(c,lv+' '+(constant?.toFixed(1)||'--'),margin+20,cy+25,colors[lv],85);
        if(r){text(c,String(r.score).padStart(7,'0'),margin+135,cy+49,43,'#ffffff',{numeric:true});text(c,P.gradeLabel(r.grade),margin+330,cy+48,35,r.grade==='φ'?o.color:r.fc?'#66ccff':'#dce4ee',{numeric:r.grade!=='φ'});text(c,'ACC '+r.acc.toFixed(2)+'%',margin+410,cy+48,28,'#cbd5e2',{numeric:true});text(c,'RKS '+r.rks.toFixed(4),width-margin-25,cy+48,29,o.color,{numeric:true,align:'right'});
          const hint=P.suggest(ctx,r,o.gain);if(o.hints)text(c,hint?`推分目标 ${hint.acc.toFixed(2)}%   →   总 RKS +${hint.gain.toFixed(4)}`:r.grade==='φ'?'ALL PERFECT':constant?'暂无单曲 +0.01 方案':'定数待更新',margin+135,cy+78,15,hint?o.color:'#8d9bac');
        }else text(c,constant?'NO RECORD / 尚未游玩':'NO CHART / 无此难度',margin+135,cy+56,24,'#8d9bac',{numeric:true});
      });
      text(c,'Illustration / '+song.illustrator,margin,978,13,'#8d9bac',{width:width-margin*2});
    } else {
      title(c,'DIFFICULTY / OVERVIEW','蓝色 V 为全连（含 φ）；各评级互斥统计',margin,410,width-margin*2,o.color);
      const widths=[.13,.18,.17,.17,.17,.18],headers=['难度','已玩 / 总谱面','通关','V','φ','平均 ACC'];
      let x=margin;headers.forEach((v,i)=>{text(c,v,x+15,465,16,i===3?'#66ccff':'#96a5b8');x+=(width-margin*2)*widths[i];});
      stat.levels.forEach((r,i)=>{let x=margin;const cy=490+i*65;c.fillStyle=i%2?'#0b111a80':'#ffffff04';c.fillRect(margin,cy,width-margin*2,61);const vals=[r.level,`${r.played} / ${r.total}`,r.clear,r.fc,r.phi,r.acc.toFixed(2)+'%'];vals.forEach((v,j)=>{text(c,v,x+15,cy+39,26,j===0?colors[r.level]:j===4?o.color:'#dde4ed',{numeric:true});x+=(width-margin*2)*widths[j];});});
      title(c,'RATING / DISTRIBUTION','蓝色 V 为全连，白色 V 为普通评级',margin,815,width-margin*2,o.color);
      const max=Math.max(1,...Object.values(stat.grades));
      Object.entries(stat.grades).forEach(([gr,n],i)=>{const row=i%4,col=Math.floor(i/4),bw=(width-margin*2-gap)/2,cx=margin+col*(bw+gap),cy=850+row*64;text(c,P.gradeLabel(gr),cx,cy+28,28,gr==='φ'?o.color:gr==='FC'?'#66ccff':'#b6c3d2',{numeric:gr!=='φ'});c.fillStyle='#ffffff09';c.fillRect(cx+65,cy+8,bw-140,22);c.fillStyle=gr==='φ'?o.color:gr==='FC'?'#66ccff':'#8cb9c7';c.fillRect(cx+65,cy+8,(bw-140)*n/max,22);text(c,n,cx+bw-5,cy+29,27,'#e8edf2',{align:'right',numeric:true});});
      text(c,'统计仅基于当前存档的历史最佳成绩，不包含存档未记录的单次游玩判定与游玩时长。',margin,1180,15,'#9aa8ba',{width:width-margin*2});
    }
    line(c,margin,height-75,width-margin*2,'#ffffff26');
    text(c,(o.watermark?'PHI PRISM  /  ':'')+'PHIGROS · 非官方成绩图'+(save.demo?' · 演示数据':''),margin,height-41,14,'#8998ad',{numeric:false});
    text(c,'DATA '+root.PHI_DATA.date,width-margin,height-41,17,'#8998ad',{align:'right',numeric:true});
    canvas.dataset.scale=String(scale);canvas.dataset.adjusted=String(scale+0.001<requestedScale);return canvas;
  }
  root.PhiRender={make,art,image};
})(window);

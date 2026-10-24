/* Phi Prism — browser-only save reader and rating engine. GPL-3.0-or-later. */
(function (root) {
  'use strict';
  const LEVELS = ['EZ', 'HD', 'IN', 'AT'];
  const songs = new Map((root.PHI_DATA?.songs || []).map(s => [s.id, s]));
  const strip = id => String(id).replace(/\.0$/, '');
  const key = r => `${r.id}|${r.level}`;
  const sum = a => a.reduce((s, r) => s + r.rks, 0);
  const cmp = (a, b) => b.rks - a.rks || b.acc - a.acc || b.score - a.score || key(a).localeCompare(key(b));
  function rating(d, acc) { return acc < 70 || !d ? 0 : d * ((acc - 55) / 45) ** 2; }
  function grade(r) {
    if (r.score === 1000000 && r.acc >= 99.99999) return 'φ';
    if (r.fc) return 'FC';
    return r.score >= 960000 ? 'V' : r.score >= 920000 ? 'S' : r.score >= 880000 ? 'A' : r.score >= 820000 ? 'B' : r.score >= 700000 ? 'C' : 'F';
  }
  // Preserve distinct internal grades for filtering and statistics.
  const gradeLabel = g => g === 'FC' ? 'V' : g;
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('JSON 顶层必须是成绩对象。');
    const raw = input.records ?? input.gameRecord ?? input.save?.gameRecord ?? input.Record;
    if (!raw || typeof raw !== 'object') throw Error('未找到 records 或 gameRecord。请导入本工具导出的 JSON 或包含 gameRecord 的存档。');
    const list = [];
    if (Array.isArray(raw)) list.push(...raw);
    else for (const [id, value] of Object.entries(raw)) {
      const values = Array.isArray(value) ? value : LEVELS.map((l, i) => value?.[l] ?? value?.[i]);
      values.slice(0, 4).forEach((v, i) => {
        if (v == null) return;
        list.push(Array.isArray(v) ? {id, level: LEVELS[i], score: v[0], acc: v[1], fc: v[2]} : {...v, id, level: LEVELS[i]});
      });
    }
    if (!list.length || list.length > 10000) throw Error('成绩数量为空或超过 10000 条。');
    const unique = new Map(); let unknown = 0;
    for (const r of list) {
      if (!r || typeof r !== 'object') throw Error('成绩条目格式不正确。');
      const id = strip(r.songId ?? r.id ?? '');
      const lv = r.level ?? r.rank ?? r.levelIndex;
      const level = Number.isInteger(lv) ? LEVELS[lv] : String(lv).toUpperCase();
      if (!id || id.length > 240 || !LEVELS.includes(level)) throw Error('成绩缺少有效曲目 ID 或难度（EZ / HD / IN / AT）。');
      const score = Number(r.score), acc = Number(r.acc ?? r.accuracy);
      if (!Number.isInteger(score) || score < 0 || score > 1000000 || !Number.isFinite(acc) || acc < 0 || acc > 100.00001) throw Error(`成绩数值不合法：${id} ${level}`);
      const meta = songs.get(id), idx = LEVELS.indexOf(level);
      const provided = Number(r.constant ?? r.chartConstant ?? r.difficulty);
      const constant = meta?.constants[idx] ?? (Number.isFinite(provided) && provided > 0 && provided < 30 ? provided : null);
      if (!constant) unknown++;
      const out = {id, level, score, acc: Math.min(100, acc), fc: r.fc === true || r.fc === 1 || r.fullCombo === true || (score === 1000000 && acc >= 99.99999), constant};
      out.rks = rating(constant, out.acc); out.grade = grade(out);
      // A save contains one independent personal best per chart; duplicate entries are invalid.
      if (unique.has(key(out))) throw Error(`发现重复谱面：${id} ${level}`);
      unique.set(key(out), out);
    }
    const p = input.profile || input.player || {};
    const summary = input.summary || input.saveInfo?.summary || {};
    const profile = {
      name: String(p.name ?? p.nickname ?? input.playerName ?? input.saveInfo?.PlayerId ?? 'Phigros 玩家').slice(0, 80),
      account: String(p.account ?? p.objectId ?? '').slice(0, 100),
      intro: String(p.intro ?? input.gameuser?.selfIntro ?? '').slice(0, 200),
      avatar: String(p.avatar ?? input.gameuser?.avatar ?? summary.avatar ?? '').slice(0, 200),
      background: String(p.background ?? input.gameuser?.background ?? '').slice(0, 200),
      challenge: Math.max(0, Math.min(9999, Number(p.challenge ?? summary.challengeModeRank ?? 0) || 0)),
      gameVersion: String(p.gameVersion ?? summary.gameVersion ?? '').slice(0, 30),
      cloudRks: Number.isFinite(Number(p.cloudRks ?? summary.rankingScore)) ? Number(p.cloudRks ?? summary.rankingScore) : null,
      updatedAt: validDate(p.updatedAt ?? input.saveInfo?.modifiedAt?.iso ?? input.saveInfo?.updatedAt ?? input.updatedAt),
      money: Array.isArray(p.money) ? p.money.slice(0, 5).map(v => Number(v) || 0) : null,
    };
    return {schema: 'phi-prism/1', profile, records: [...unique.values()], importedAt: new Date().toISOString(), demo: input.demo === true, unknown};
  }
  function validDate(v) { const d = new Date(v); return !v || !Number.isFinite(+d) ? '' : d.toISOString(); }
  function ranked(save) { return save.records.filter(r => r.constant && r.score > 0).sort(cmp); }
  function board(save, n = 30) {
    n = Math.max(4, Math.min(100, Math.round(n)));
    const all = ranked(save), slots = n === 20 ? 1 : 3;
    const phi = all.filter(r => r.grade === 'φ').slice(0, slots);
    const best = all.slice(0, n - slots);
    return {n, slots, phi, best, overflow: all.slice(n - slots, n - slots + 6), average: (sum(phi) + sum(best)) / n, all};
  }
  function context(save) {
    const b = board(save, 30);
    return {rating: b.average, best: b.all.slice(0, 28), phi: b.all.filter(r => r.grade === 'φ').slice(0, 4)};
  }
  function projection(ctx, r, acc) {
    const best = ctx.best.filter(x => key(x) !== key(r)).slice(0, 27);
    const phi = ctx.phi.filter(x => key(x) !== key(r)).slice(0, 3);
    return (sum(best) + Math.max(0, rating(r.constant, acc) - (best.length === 27 ? best[26].rks : 0)) + sum(phi) + (acc >= 100 ? Math.max(0, r.constant - (phi.length === 3 ? phi[2].rks : 0)) : 0)) / 30;
  }
  function suggest(ctx, r, gain = 0.01) {
    if (!r.constant || r.acc >= 100) return null;
    const target = ctx.rating + gain;
    if (projection(ctx, r, 100) + 1e-10 < target) return null;
    let lo = r.acc, hi = 100;
    for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (projection(ctx, r, m) + 1e-12 >= target) hi = m; else lo = m; }
    let acc = Math.min(100, Math.ceil((hi - 1e-9) * 100) / 100);
    if (projection(ctx, r, acc) + 1e-9 < target) acc = Math.min(100, acc + 0.01);
    return {acc, gain: projection(ctx, r, acc) - ctx.rating, delta: acc - r.acc, phi: acc === 100};
  }
  function stats(save) {
    const levels = LEVELS.map(level => {
      const played = save.records.filter(r => r.level === level && (r.score > 0 || r.acc > 0));
      const total = (root.PHI_DATA?.songs || []).filter(s => s.constants[LEVELS.indexOf(level)]).length;
      return {level, total, played: played.length, clear: played.filter(r => r.score >= 700000).length, fc: played.filter(r => r.fc).length, phi: played.filter(r => r.grade === 'φ').length, acc: played.length ? played.reduce((s, r) => s + r.acc, 0) / played.length : 0, score: played.reduce((s, r) => s + r.score, 0)};
    });
    const grades = Object.fromEntries(['φ', 'FC', 'V', 'S', 'A', 'B', 'C', 'F'].map(g => [g, save.records.filter(r => r.grade === g && (r.score > 0 || r.acc > 0)).length]));
    const chapters = new Map();
    for (const s of root.PHI_DATA?.songs || []) {
      const chapter = s.chapter || '其他曲目';
      if (!chapters.has(chapter)) chapters.set(chapter, {chapter, total: 0, played: 0, clear: 0, fc: 0, phi: 0});
      chapters.get(chapter).total += s.constants.filter(Boolean).length;
    }
    for (const r of save.records) {
      const c = chapters.get(songs.get(r.id)?.chapter || '其他曲目');
      if (c) {c.played += Number(r.score > 0 || r.acc > 0); c.clear += Number(r.score >= 700000); c.fc += Number(r.fc); c.phi += Number(r.grade === 'φ');}
    }
    return {levels, grades, chapters: [...chapters.values()], played: levels.reduce((a, x) => a + x.played, 0), total: levels.reduce((a, x) => a + x.total, 0), fc: levels.reduce((a, x) => a + x.fc, 0), phi: levels.reduce((a, x) => a + x.phi, 0), score: levels.reduce((a, x) => a + x.score, 0)};
  }
  function portable(save) {
    return {schema: 'phi-prism/1', exportedAt: new Date().toISOString(), dataDate: root.PHI_DATA?.date, demo: !!save.demo,
      profile: {...save.profile}, records: save.records.map(({id, level, score, acc, fc, constant}) => ({id, level, score, acc, fc, constant}))};
  }
  class Reader {
    constructor(bytes) { this.a = bytes; this.p = 0; this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
    need(n) { if (this.p + n > this.a.length) throw Error('存档结构损坏或版本不兼容（数据截断）。'); }
    u8() { this.need(1); return this.a[this.p++]; }
    u16() { this.need(2); const n = this.v.getUint16(this.p, true); this.p += 2; return n; }
    u32() { this.need(4); const n = this.v.getUint32(this.p, true); this.p += 4; return n; }
    f32() { this.need(4); const n = this.v.getFloat32(this.p, true); this.p += 4; return n; }
    varint() { const a = this.u8(); return a < 128 ? a : (a & 127) | (this.u8() << 7); }
    str() { const n = this.varint(); this.need(n); const s = new TextDecoder('utf-8', {fatal: true}).decode(this.a.subarray(this.p, this.p + n)); this.p += n; return s; }
  }
  function fromBase64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
  function decrypt(bytes) {
    if (bytes.length < 17 || (bytes.length - 1) % 16) throw Error('加密存档长度不正确。');
    const C = root.CryptoJS;
    const out = C.AES.decrypt({ciphertext: C.lib.WordArray.create(bytes.subarray(1))}, C.enc.Base64.parse('6Jaa0qVAJZuXkZCLiOa/Ax5tIZVu+taKUN1V1nqwkks='), {iv: C.enc.Base64.parse('Kk/wisgNYwcAV8WVGMgyUw=='), mode: C.mode.CBC, padding: C.pad.NoPadding});
    const a = new Uint8Array(out.sigBytes);
    for (let i = 0; i < a.length; i++) a[i] = (out.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 255;
    const padding = a[a.length - 1];
    if (padding < 1 || padding > 16 || a.slice(-padding).some(x => x !== padding)) throw Error('存档解密失败：密钥、文件或版本不匹配。');
    return a.subarray(0, a.length - padding);
  }
  function parseSummary(s) {
    const r = new Reader(fromBase64(s));
    const saveVersion = r.u8(), challenge = r.u16(), cloudRks = r.f32(), gameVersion = r.varint(), avatar = r.str();
    return {saveVersion, challenge, cloudRks, gameVersion, avatar};
  }
  function parseZip(bytes, profile = {}) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length > 12 * 1024 * 1024) throw Error('存档 ZIP 超过 12 MB。');
    const names = new Set(['gameRecord', 'user', 'gameProgress']); let total = 0;
    const files = root.fflate.unzipSync(bytes, {filter: f => {
      if (!names.has(f.name)) return false;
      if ((total += f.originalSize) > 8 * 1024 * 1024) throw Error('解压数据超过安全大小限制。');
      return true;
    }});
    if (!files.gameRecord) throw Error('ZIP 根目录未找到 gameRecord；请选择原始 Phigros 云存档 ZIP。');
    if (files.gameRecord[0] !== 1) throw Error(`暂不支持 gameRecord 版本 ${files.gameRecord[0]}，请更新解析器。`);
    const r = new Reader(decrypt(files.gameRecord)), count = r.varint(), records = [];
    if (count > 3000) throw Error('存档曲目数量异常。');
    for (let i = 0; i < count; i++) {
      const id = r.str(), len = r.varint(), end = r.p + len;
      r.need(len);
      const exist = r.u8(), fc = r.u8();
      for (let l = 0; l < 5; l++) if (exist & (1 << l)) {
        const score = r.u32(), acc = r.f32();
        if (l < 4) records.push({id, level: LEVELS[l], score, acc, fc: !!(fc & (1 << l))});
      }
      if (r.p > end) throw Error('gameRecord 记录长度异常。');
      r.p = end;
    }
    const p = {...profile};
    if (files.user) {
      if (files.user[0] !== 1) throw Error('不支持的 user 存档版本。');
      const u = new Reader(decrypt(files.user)); u.u8(); p.intro = u.str(); p.avatar = u.str(); p.background = u.str();
    }
    if (files.gameProgress) {
      const g = new Reader(decrypt(files.gameProgress)); g.u8(); g.str(); g.varint(); p.challenge = g.u16(); p.money = Array.from({length: 5}, () => g.varint());
    }
    return normalize({profile: p, records});
  }
  const BASE = 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1';
  function connectionError(code, stage, detail) {
    const error = Error(`${stage}失败：${detail}`);
    error.code = code; error.stage = stage; return error;
  }
  function safeNetworkDetail(error, token) {
    return `${error?.name || 'Error'}: ${error?.message || '请求未完成'}`.split(token).join('[已隐藏]').replace(/[a-zA-Z0-9]{25,}/g, '[已隐藏]').slice(0, 180);
  }
  async function cloudRequest(path, token, stage, timeout = 45000, file = false) {
    if (typeof fetch !== 'function') throw connectionError('UNSUPPORTED', stage, '当前浏览器不支持 Fetch，请使用新版 Chrome、Edge、Firefox 或 Safari。');
    if (root.navigator?.onLine === false) throw connectionError('OFFLINE', stage, '浏览器处于离线状态，请联网后重试。');
    // Avoid AbortSignal.timeout(), which is absent in older browsers and WebViews.
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    try {
      const request = (async () => {
        let response;
        try {
          response = await fetch(file ? path : BASE + path, {
            ...(file ? {} : {headers: {'X-LC-Id': 'rAK3FfdieFob2Nn8Am', 'X-LC-Key': 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0', 'X-LC-Session': token}}),
            mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
            ...(controller ? {signal: controller.signal} : {})
          });
        } catch (error) {
          throw connectionError('NETWORK', stage, `浏览器未能读取响应（${safeNetworkDetail(error, token)}）。网络、跨域策略或浏览器扩展都可能导致此错误；请点击“连接诊断”。`);
        }
        if (file) {
          if (!response.ok) throw connectionError('HTTP', stage, `HTTP ${response.status}。可手动下载下方 ZIP 后导入。`);
          return response.blob();
        }
        let json;
        try { json = await response.json(); }
        catch { throw connectionError('RESPONSE', stage, `HTTP ${response.status} 返回的内容不是有效 JSON，可能是网络登录页或接口异常。`); }
        if (!json || typeof json !== 'object' || Array.isArray(json)) throw connectionError('RESPONSE', stage, '接口返回格式不正确。');
        if (!response.ok || json.error && json.code) {
          if (response.status === 401 || json.code === 209 || json.code === 211) throw connectionError('AUTH', stage, `sessionToken 无效或已失效（HTTP ${response.status}，接口代码 ${json.code ?? '未提供'}），请重新获取。`);
          throw connectionError('HTTP', stage, `HTTP ${response.status}，接口代码 ${json.code ?? '未提供'}。`);
        }
        return json;
      })();
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
        reject(connectionError('TIMEOUT', stage, `${Math.round(timeout / 1000)} 秒内未完成请求。请点击“连接诊断”，检查当前网络能否访问游戏云存档接口。`));
        controller?.abort();
      }, timeout); });
      return await Promise.race([request, deadline]);
    } finally { clearTimeout(timer); }
  }
  async function diagnoseCloud() {
    const start = Date.now();
    const report = {version: '2026-10-24-r2', protocol: root.location?.protocol || 'unknown', secureContext: root.isSecureContext === true,
      online: root.navigator?.onLine !== false, browser: String(root.navigator?.userAgent || 'unknown').slice(0, 240),
      fetch: typeof fetch === 'function', abortController: typeof AbortController === 'function',
      nativeTimeout: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'};
    // Deliberately invalid fixture; never read the token input or stored credentials.
    try {
      await cloudRequest('/users/me', '0000000000000000000000000', '接口连通性检测', 15000);
      report.result = '接口响应可读取，但测试占位符意外通过认证；请勿据此判断真实账号。'; report.code = 'UNEXPECTED';
    } catch (error) {
      report.code = error.code || 'UNKNOWN';
      report.result = error.code === 'AUTH' ? '连接正常：浏览器已读到接口对测试占位符的拒绝响应。此结果不验证你的 sessionToken 或存档下载。' : error.message;
    }
    if (report.code === 'AUTH') {
      // Filter by a fixed, nonexistent fixture user. Never query an unfiltered list.
      const params = new URLSearchParams({skip: '0', limit: '1', where: JSON.stringify({user: {__type: 'Pointer', className: '_User', objectId: 'phi-prism-connectivity-fixture'}}), include: 'cover,gameFile'});
      try {
        const result = await cloudRequest('/gamesaves?' + params, '0000000000000000000000000', '存档列表连通性检测', 15000);
        report.code = Array.isArray(result.results) ? 'OK' : 'RESPONSE';
        report.result = report.code === 'OK' ? '资料接口与存档列表接口均可访问；不验证真实 token 或存档文件下载。' : '存档列表接口可读取，但返回格式不正确。';
      } catch (error) {
        report.code = error.code === 'AUTH' ? 'OK' : error.code || 'UNKNOWN';
        report.result = error.code === 'AUTH' ? '资料接口与存档列表接口均可读取测试占位符的拒绝响应；不验证真实 token 或存档文件下载。' : error.message;
      }
    }
    report.elapsedMs = Date.now() - start; return report;
  }
  async function cloud(token, onStage = () => {}, onFile = () => {}) {
    if (!/^[a-zA-Z0-9]{25}$/.test(token)) throw Error('sessionToken 应为 25 位英文字母或数字。');
    onStage('正在读取玩家资料…');
    const user = await cloudRequest('/users/me', token, '读取玩家资料');
    if (!user.objectId) throw Error('云存档接口未返回玩家 ID。');
    onStage('正在查询最新云存档…');
    const params = new URLSearchParams({skip: '0', limit: '100', where: JSON.stringify({user: {__type: 'Pointer', className: '_User', objectId: user.objectId}}), include: 'cover,gameFile'});
    // The slash-suffixed route returns a 301 without CORS headers.
    const j = await cloudRequest('/gamesaves?' + params, token, '查询云存档');
    const saves = (j.results || []).filter(s => s.gameFile?.url).sort((a, b) => +new Date(b.modifiedAt?.iso || b.updatedAt) - +new Date(a.modifiedAt?.iso || a.updatedAt));
    if (!saves.length) throw Error('此账号没有云存档，请先在游戏内上传存档。');
    const s = saves[0], url = new URL(s.gameFile.url);
    if (url.protocol !== 'https:') throw Error('存档链接不是 HTTPS，无法安全下载。');
    // Never attach the session header to the storage/CDN request.
    onFile(url.href);
    onStage('正在下载并解密存档…');
    let blob;
    try { blob = await cloudRequest(url.href, token, '下载存档', 60000, true); }
    catch (error) { error.message += ' 也可点击下方“下载原始存档 ZIP”，保存后导入本站。'; throw error; }
    if (blob.size > 12 * 1024 * 1024) throw Error('存档文件超过 12 MB。');
    let summary = {};
    if (s.summary) { try { summary = parseSummary(s.summary); } catch { /* record parser remains authoritative */ } }
    const save = parseZip(new Uint8Array(await blob.arrayBuffer()), {...summary, name: user.nickname || user.username || 'Phigros 玩家', account: user.objectId, updatedAt: s.modifiedAt?.iso || s.updatedAt});
    onStage('同步完成');
    return save;
  }
  function demo() {
    let seed = 71923;
    function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    const records = [];
    for (const s of songs.values()) for (let i = 0; i < 4; i++) {
      const d = s.constants[i]; if (!d || (i < 2 && rand() < 0.54) || rand() < 0.12) continue;
      const acc = d <= 13.5 && rand() < 0.23 ? 100 : Math.round(Math.min(99.97, Math.max(75, 100 - (d > 15 ? (d - 14) * 2.0 : 0.4) - rand() * 3.2)) * 100) / 100;
      const fc = acc === 100 || (acc > 98 && rand() < 0.42);
      const score = acc === 100 ? 1000000 : Math.round(Math.min(999999, acc * 9000 + (fc ? 100000 : 85000 + rand() * 14500)));
      records.push({id: s.id, level: LEVELS[i], score, acc, fc});
    }
    return normalize({demo: true, profile: {name: 'PRISM / 演示玩家', account: '__demo__', intro: '每一道判定线，都是新的可能。', challenge: 345, updatedAt: new Date().toISOString()}, records});
  }
  root.Phi = {LEVELS, songs, key, strip, rating, grade, gradeLabel, normalize, board, context, projection, suggest, stats, portable, Reader, decrypt, parseSummary, parseZip, cloud, diagnoseCloud, demo};
  if (typeof module !== 'undefined') module.exports = root.Phi;
})(typeof window !== 'undefined' ? window : globalThis);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Production files are unmodified, executed in a browser-like global scope.
const sandbox = {console, TextDecoder, Uint8Array, ArrayBuffer, DataView, Date, URL, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout, atob};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['assets/vendor/crypto-js.js', 'assets/vendor/fflate.js', 'assets/data.js', 'assets/core.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), sandbox);
const P = sandbox.Phi, C = sandbox.CryptoJS, F = sandbox.fflate;
assert.equal(P.rating(15, 69.99), 0);
assert.equal(P.rating(15, 100), 15);
assert.ok(Math.abs(P.rating(15, 99) - 14.34074074074074) < 1e-10);
const demo = P.demo();
assert.ok(demo.records.length > 300);
const b30 = P.board(demo), b20 = P.board(demo, 20);
assert.equal(b30.best.length, 27);assert.equal(b30.phi.length, 3);
assert.equal(b20.best.length, 19);assert.equal(b20.phi.length, 1);
// Independent brute-force oracle, including candidate replacement and phi slots.
function brute(save, r, acc) {
  const all = save.records.filter(x=>P.key(x)!==P.key(r)).map(x=>({...x}));
  all.push({...r, acc, score:acc===100?1000000:r.score, fc:acc===100||r.fc, rks:P.rating(r.constant,acc), grade:acc===100?'φ':r.grade});
  const best=all.filter(x=>x.constant&&x.score>0).sort((a,b)=>b.rks-a.rks);
  const phis=best.filter(x=>x.grade==='φ').slice(0,3);
  return (best.slice(0,27).reduce((s,x)=>s+x.rks,0)+phis.reduce((s,x)=>s+x.rks,0))/30;
}
const ctx=P.context(demo);
let tested=0, proposed=0;
for (const r of demo.records) {
  for (const a of [r.acc, (r.acc+100)/2, 100]) {
    assert.ok(Math.abs(P.projection(ctx,r,a)-brute(demo,r,a))<1e-9, 'projection differs from independent ranking');tested++;
  }
  const h=P.suggest(ctx,r,.01);
  if(h){assert.ok(brute(demo,r,h.acc)+1e-9>=ctx.rating+.01);assert.ok(h.acc>=r.acc&&h.acc<=100);assert.ok(h.acc===100||brute(demo,r,h.acc-.01)<ctx.rating+.01+1e-8);proposed++;}
}
const one=P.normalize({records:[{id:'test-only',level:'IN',constant:15,score:1000000,acc:100,fc:true}],profile:{name:'One'}});
assert.equal(P.context(one).rating, 1); // Same chart occupies one Best and one phi slot, empty slots zero.
assert.equal(P.board(one,20).average,1.5);
assert.throws(()=>P.normalize({records:[{id:'x',level:'IN',score:1,acc:NaN}]}));
assert.throws(()=>P.normalize({records:[{id:'x',level:'IN',score:1,acc:101}]}));
assert.throws(()=>P.normalize({records:[{id:'x',level:'IN',score:1000001,acc:99}]}));
assert.throws(()=>P.normalize({records:[{id:'x',level:'IN',score:1,acc:90},{id:'x',level:'IN',score:2,acc:91}]}));
const portable=P.portable(demo);assert.equal(P.normalize(JSON.parse(JSON.stringify(portable))).records.length,demo.records.length);
assert.ok(!JSON.stringify(P.portable(P.normalize({...portable,sessionToken:'DO_NOT_EXPORT',profile:{...portable.profile,token:'NEVER_EXPORT'}}))).includes('EXPORT'));
const raw=P.normalize({gameRecord:{'fixture-only.0':[[987654,99.12,true],null,[960000,98,false],null]}});
assert.equal(raw.records[0].id,'fixture-only');assert.equal(raw.records[1].level,'IN');
// Binary fixture is built independently with node Buffer and then encrypted using the game format.
const chunks=[];const u8=x=>chunks.push(Buffer.from([x]));const vi=x=>{if(x<128)u8(x);else{u8((x&127)|128);u8(x>>7);}};const str=s=>{const b=Buffer.from(s);vi(b.length);chunks.push(b);};
vi(2);
for(const [id,score,acc] of [['fixture-long-'+ 'a'.repeat(130)+'.0',999999,99.875],['Glaciaxion.SunsetRay.0',1000000,100]]){
 str(id);vi(10);u8(4);u8(4);const b=Buffer.alloc(8);b.writeUInt32LE(score);b.writeFloatLE(acc,4);chunks.push(b);
}
const rawBytes=Buffer.concat(chunks);
function encrypted(b){const words=C.lib.WordArray.create(new Uint8Array(b));const enc=C.AES.encrypt(words,C.enc.Base64.parse('6Jaa0qVAJZuXkZCLiOa/Ax5tIZVu+taKUN1V1nqwkks='),{iv:C.enc.Base64.parse('Kk/wisgNYwcAV8WVGMgyUw==')});const a=Buffer.from(enc.ciphertext.toString(C.enc.Base64),'base64');return new Uint8Array(Buffer.concat([Buffer.from([1]),a]));}
const zip=F.zipSync({gameRecord:encrypted(rawBytes)});
const parsed=P.parseZip(zip,{name:'Binary fixture'});
assert.equal(parsed.records.length,2);assert.equal(parsed.records[0].acc,99.875);assert.equal(parsed.records[1].grade,'φ');
assert.throws(()=>P.parseZip(F.zipSync({gameRecord:new Uint8Array([7,1,2])})),/版本/);
assert.throws(()=>P.parseZip(F.zipSync({other:new Uint8Array([1,2,3])})),/gameRecord/);
// Restrict every cloud credential request to the known game origin; file fetch has no session headers.
let calls=[];
sandbox.fetch=async (url,opts)=>{calls.push({url:String(url),opts});if(String(url).endsWith('/users/me'))return {ok:true,json:async()=>({objectId:'fixture-player',nickname:'Fixture'})};if(String(url).includes('/gamesaves?'))return {ok:true,json:async()=>({results:[{gameFile:{url:'https://files.example.test/save'},updatedAt:'2026-10-21T00:00:00Z'}]})};return {ok:true,blob:async()=>({size:zip.length,arrayBuffer:async()=>zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)})};};
(async()=>{const cloud=await P.cloud('a'.repeat(25));assert.equal(cloud.profile.name,'Fixture');assert.equal(calls.length,3);assert.ok(calls.slice(0,2).every(x=>x.url.startsWith('https://rak3ffdi.cloud.tds1.tapapis.cn/1.1/')));assert.ok(calls[0].opts.headers['X-LC-Session']);assert.equal(calls[2].opts.headers,undefined);assert.equal(calls[2].opts.credentials,'omit');fs.mkdirSync(path.join(root,'examples'),{recursive:true});fs.writeFileSync(path.join(root,'examples','demo-scores.json'),JSON.stringify(portable,null,2));fs.writeFileSync(path.join(root,'examples','test-save.zip'),Buffer.from(zip));console.log(JSON.stringify({passed:true,records:demo.records.length,projectionComparisons:tested,validatedSuggestions:proposed,binaryRecords:parsed.records.length,cloudRequests:calls.length}));})().catch(e=>{console.error(e);process.exitCode=1;});

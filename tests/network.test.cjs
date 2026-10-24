const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/core.js'),'utf8');
const token='a'.repeat(25);
function setup(fetch,extra={}){
 const sandbox={console,TextDecoder,Uint8Array,ArrayBuffer,DataView,Date,URL,URLSearchParams,atob,setTimeout,clearTimeout,AbortController,
  navigator:{onLine:true,userAgent:'FixtureBrowser'},location:{protocol:'https:'},isSecureContext:true,fetch,...extra};
 sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox);return sandbox.Phi;
}
const json=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
(async()=>{
 let count=0;
 // No AbortSignal global or native timeout: the request still reaches the server.
 const noNativeTimeout=setup(async()=>{count++;return json(400,{code:211,error:'Could not find user.'});});
 await assert.rejects(noNativeTimeout.cloud(token),e=>e.code==='AUTH'&&e.stage==='读取玩家资料');assert.equal(count,1);
 const diag=await noNativeTimeout.diagnoseCloud();assert.equal(diag.code,'AUTH');assert.equal(diag.nativeTimeout,false);assert(!JSON.stringify(diag).includes(token));
 // Also support environments without AbortController, while keeping a deadline.
 await assert.rejects(setup(async()=>json(401,{code:209}),{AbortController:undefined}).cloud(token),e=>e.code==='AUTH');
 // Fetch rejections, invalid bodies and HTTP errors must remain distinguishable.
 await assert.rejects(setup(async()=>{throw TypeError('Failed to fetch '+token);}).cloud(token),e=>e.code==='NETWORK'&&!e.message.includes(token)&&e.message.includes('TypeError'));
 await assert.rejects(setup(async()=>({status:502,json:async()=>{throw SyntaxError('HTML');}})).cloud(token),e=>e.code==='RESPONSE'&&e.message.includes('502'));
 await assert.rejects(setup(async()=>json(403,{code:119})).cloud(token),e=>e.code==='HTTP'&&e.message.includes('119'));
 await assert.rejects(setup(async()=>json(200,null)).cloud(token),e=>e.code==='RESPONSE');
 let offlineCalls=0;
 await assert.rejects(setup(async()=>{offlineCalls++;},{navigator:{onLine:false}}).cloud(token),e=>e.code==='OFFLINE');assert.equal(offlineCalls,0);
 await assert.rejects(setup(undefined).cloud(token),e=>e.code==='UNSUPPORTED');
 // A stalled fetch or response body times out; timers do not escape test scope.
 const fastTimers={setTimeout:fn=>setTimeout(fn,5)};
 await assert.rejects(setup(()=>new Promise(()=>{}),fastTimers).cloud(token),e=>e.code==='TIMEOUT');
 await assert.rejects(setup(async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}),fastTimers).cloud(token),e=>e.code==='TIMEOUT');
 // Report the actual stage, including the separate CDN download and fallback.
 await assert.rejects(setup(async(url)=>String(url).endsWith('/users/me')?json(200,{objectId:'fixture'}):Promise.reject(TypeError('NetworkError'))).cloud(token),e=>e.code==='NETWORK'&&e.stage==='查询云存档');
 const calls=[];let downloadLink='';
 const fileFailure=setup(async(url,options)=>{
  calls.push({url,options});
  if(String(url).endsWith('/users/me'))return json(200,{objectId:'fixture'});
  if(String(url).includes('/gamesaves/'))return json(200,{results:[{gameFile:{url:'https://files.example.test/save.zip'}}]});
  throw TypeError('Failed to fetch');
 });
 await assert.rejects(fileFailure.cloud(token,()=>{},url=>downloadLink=url),e=>e.code==='NETWORK'&&e.stage==='下载存档'&&e.message.includes('下载原始存档 ZIP'));
 assert.equal(downloadLink,'https://files.example.test/save.zip');assert.equal(calls[2].options.headers,undefined);assert.equal(calls[2].options.credentials,'omit');
 let diagnosticToken='';
 const safeDiag=setup(async(_url,options)=>{diagnosticToken=options.headers['X-LC-Session'];return json(400,{code:211});});
 await safeDiag.diagnoseCloud();assert.equal(diagnosticToken,'0'.repeat(25));assert.notEqual(diagnosticToken,token);
 console.log('Network compatibility, deadlines, error stages, credential isolation and token-free diagnostics: passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

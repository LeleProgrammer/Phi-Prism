const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"/g)].map(m=>m[1]);
const sandbox={window:{}};vm.createContext(sandbox);
let chunks=0;
for(const src of scripts){
 assert(!src.startsWith('/'),'Assets must work at a Pages repository subpath.');
 const name=src.split('?')[0],file=path.join(root,name);
 assert(fs.existsSync(file),'Missing script: '+name);
 const source=fs.readFileSync(file,'utf8');
 let compiled;
 try{compiled=new vm.Script(source,{filename:name});}
 catch(error){throw Error(name+': '+error.message);}
 if(name==='assets/data.js'||name==='assets/art.js'||name.startsWith('assets/art-data/'))compiled.runInContext(sandbox);
 if(name.startsWith('assets/art-data/')){chunks++;assert(Buffer.byteLength(source)<=512*1024,'Artwork script exceeds 512 KiB');}
}
const catalog=sandbox.window.PHI_DATA,art=sandbox.window.PHI_ART;
assert(chunks>1,'Artwork must be split into small static scripts.');
assert.equal(Object.keys(art).length,catalog.songs.length,'Every catalog song must have artwork.');
for(const song of catalog.songs){
 const uri=art[song.id];assert(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(uri),'Invalid artwork: '+song.id);
 const bytes=Buffer.from(uri.split(',')[1],'base64');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(bytes.readUInt32LE(4)+8,bytes.length,'Truncated image: '+song.id);
}
const firstPart=scripts.findIndex(s=>s.startsWith('assets/art-data/'));
const lastPart=scripts.findLastIndex(s=>s.startsWith('assets/art-data/'));
assert(scripts.findIndex(s=>s.startsWith('assets/art.js'))<firstPart);
assert(scripts.findIndex(s=>s.startsWith('assets/app.js'))>lastPart);
console.log(JSON.stringify({passed:true,covers:catalog.songs.length,chunks,allScriptSyntaxChecked:true}));

const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const root=path.resolve(__dirname,'..');const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'assets/chart-engine.js'),'utf8'),box);const E=box.PhiChartEngine;
const chart={formatVersion:3,offset:.5,judgeLineList:[{bpm:120,speedEvents:[{startTime:0,endTime:128,value:1,floorPosition:0}],judgeLineMoveEvents:[{startTime:0,endTime:128,start:.2,end:.8,start2:.5,end2:.5}],notesAbove:[{type:1,time:64,holdTime:0,positionX:0,speed:1,floorPosition:1}],notesBelow:[]}]};const c=E.compile(chart);assert.equal(c.lines[0].notes[0].time,1);assert.equal(E.floor(c.lines[0],1),1);assert(Math.abs(E.value(c.lines[0].move,1,.5)-.5)<1e-9);
let draws=0;const context=new Proxy({canvas:{width:1280,height:720}}, {get(o,k){if(k in o)return o[k];return (...v)=>{for(const n of v)if(typeof n==='number')assert(Number.isFinite(n),k+' got NaN');draws++;};},set(o,k,v){o[k]=v;return true;}});
for(const t of [0,1,2,0,.7,1.5])E.draw(context,c,t,{});assert(draws>0);assert.throws(()=>E.compile({formatVersion:100}));console.log('Chart timing, seeking, finite drawing coordinates and validation passed.');

// Official speed events no longer include floorPosition: integrate all segments.
const multi=E.compile({formatVersion:3,judgeLineList:[{bpm:120,speedEvents:[{startTime:0,endTime:64,value:1.5},{startTime:64,endTime:128,value:2},{startTime:128,endTime:6400,value:1}],notesAbove:[],notesBelow:[]}]});
assert.equal(E.floor(multi.lines[0],1),1.5);assert.equal(E.floor(multi.lines[0],2),3.5);assert.equal(E.floor(multi.lines[0],50),51.5);
for(const t of [50,1,70,2,50])assert.equal(E.floor(multi.lines[0],t),t<1?t*1.5:t<2?1.5+(t-1)*2:3.5+(t-2));
console.log('Multi-speed cumulative floor and arbitrary seek regression passed.');

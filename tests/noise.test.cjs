const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const b={};vm.createContext(b);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/chart-noise.js'),'utf8'),b);const N=b.PhiNoise;
const plain={bottomLeftPercentage:{x:.25,y:.25},topRightPercentage:{x:.75,y:.75}};const p=N.pose(plain,0,1280,720);assert.equal(p.x,640);assert.equal(p.y,360);assert.equal(p.width,640);assert.equal(p.height,360);assert.equal(N.ease(0,.5),.5);assert.equal(N.ease(1,.5),.25);assert.equal(N.ease(13,.5),0);assert.equal(N.ease(14,.5),1);
const areas=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ametrine-noise.json'))).blockAreaList;
for(const a of areas){for(const t of [55,64,65,70,75,80,65]){const pose=N.pose(a,t,1280,720);assert(Object.values(pose).every(Number.isFinite));}assert.deepEqual(N.pose(a,65,1280,720),N.pose(a,65,1280,720));}
console.log('Real blockAreaList geometry, easing and seek determinism passed.');

#!/usr/bin/env python3
"""Download Phi Prism practice resources. Python 3.8+, standard library only."""
import argparse,concurrent.futures,hashlib,json,time,urllib.request,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://raw.githubusercontent.com/7aGiven/Phigros_Resource/'
def valid(data,kind):
 if kind=='charts':
  j=json.loads(data)
  if j.get('formatVersion') not in (1,3) or not isinstance(j.get('judgeLineList'),list):raise ValueError('Unsupported chart')
 elif kind=='audio':
  if not data.startswith(b'OggS'):raise ValueError('Not Ogg audio')
 else:
  if not data.startswith(b'\x89PNG'):raise ValueError('Not PNG illustration')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--chapter',default='',help='Chapter name substring');p.add_argument('--song',default='',help='Song name or ID substring');p.add_argument('--difficulty',nargs='+',choices=['EZ','HD','IN','AT'],default=['EZ','HD','IN','AT']);p.add_argument('--types',nargs='+',choices=['charts','audio','illustrations'],default=['charts','audio']);p.add_argument('--workers',type=int,default=4);p.add_argument('--refresh',action='store_true');args=p.parse_args()
 catalog=json.loads((ROOT/'assets/charts-index.json').read_text('utf-8'));tasks=[]
 for s in catalog['songs']:
  if args.chapter.lower() not in s['chapter'].lower() or args.song.lower() not in (s['id']+' '+s['title']).lower():continue
  if 'charts' in args.types:
   for lv in args.difficulty:
    if s['constants'][['EZ','HD','IN','AT'].index(lv)]:tasks.append(('charts',s,lv,'chart/'+urllib.parse.quote(s['id']+'.0',safe='')+'/'+lv+'.json',ROOT/'offline/charts'/s['chapterKey']/s['key']/(lv+'.json')))
  if 'audio' in args.types:tasks.append(('audio',s,'','music/'+urllib.parse.quote(s['id'],safe='')+'.ogg',ROOT/'offline/audio'/(s['key']+'.ogg')))
  if 'illustrations' in args.types:tasks.append(('illustrations',s,'','illustrationLowRes/'+urllib.parse.quote(s['id'],safe='')+'.png',ROOT/'offline/illustrations'/(s['key']+'.png')))
 def run(task):
  kind,s,lv,url,path=task
  try:
   data=None
   if path.exists() and not args.refresh:
    try:data=path.read_bytes();valid(data,kind)
    except Exception:data=None
   if data is None:
    error=None
    for attempt in range(3):
     try:
      with urllib.request.urlopen(urllib.request.Request(BASE+url,headers={'User-Agent':'Phi-Prism-Downloader/1.0'}),timeout=60) as response:data=response.read(80*1024*1024+1)
      if len(data)>80*1024*1024:raise ValueError('File exceeds 80 MiB')
      valid(data,kind);break
     except Exception as e:error=e;data=None;time.sleep(attempt+1)
    if data is None:raise error
    path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix('.part');tmp.write_bytes(data);tmp.replace(path)
   if kind=='charts':
    wrapper='window.PhiOfflineChart('+json.dumps(s['key'])+','+json.dumps(lv)+','+data.decode('utf-8-sig')+');\n'
    path.with_suffix('.js').write_text(wrapper,'utf-8')
   return {'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
  except Exception as e:return {'song':s['id'],'kind':kind,'difficulty':lv,'error':str(e)}
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(8,args.workers))) as pool:
  for i,result in enumerate(pool.map(run,tasks),1):results.append(result);print('[%d/%d] %s'%(i,len(tasks),result.get('path') or result),flush=True)
 out=ROOT/'offline';out.mkdir(exist_ok=True);(out/'download-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf-8');fail=sum('error' in r for r in results);print('Completed:',len(results)-fail,'Failed:',fail)
 if fail:raise SystemExit(1)
if __name__=='__main__':main()

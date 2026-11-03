#!/usr/bin/env python3
"""Write frame coordinates for untouched original PNGs; stdlib only, no pixel edits."""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/design/worker-source-v01'
OUT=ROOT/'art-source/original-v02'


def build():
    audit=json.loads((SOURCE/'audit.json').read_text())
    sizes={x['file']:x for x in audit['files']}
    for item in sizes.values():
        assert hashlib.sha256((SOURCE/item['file']).read_bytes()).hexdigest()==item['sha256']
    previous=json.loads((ROOT/'art-source/worker/v01/manifest.json').read_text())
    result={'version':'original-v02','status':'original-images-coordinate-map-not-integrated',
            'pixelProcessing':'none','viewport':{'width':384,'height':384,'pivot':[192,272]},
            'directions':previous['directions'],'animations':{},
            'limitations':['Registration uses approximate helmet/ground landmarks from source; original pose/tool variation remains.',
                          'Death poses may turn within an initial-heading row; no artistic correction is applied.',
                          'Frame rectangles retain source gutters and partial alpha, not only thresholded silhouette bounds.']}
    for action,a in previous['animations'].items():
        records=previous['sourceFrames'][action];cols=a['frames']
        width,height=sizes[action+'.png']['size']
        by_source={row:sorted([r for r in records if r['sourceRow']==row],key=lambda r:r['frame']) for row in range(8)}
        # Divide empty gutters, not bodies. The full rectangular slot (including
        # all partial-alpha edge pixels) is read directly from the original PNG.
        ycuts=[0]+[round((max(r['sourceBounds'][3] for r in by_source[row-1])+min(r['sourceBounds'][1] for r in by_source[row]))/2) for row in range(1,8)]+[height]
        rects={}
        for row,items in by_source.items():
            xcuts=[0]+[round((items[c-1]['sourceBounds'][2]+items[c]['sourceBounds'][0])/2) for c in range(1,cols)]+[width]
            for c in range(cols):rects[(row,c)]=[xcuts[c],ycuts[row],xcuts[c+1]-xcuts[c],ycuts[row+1]-ycuts[row]]
        frames=[]
        for r in records:
            x,y,w,h=rects[(r['sourceRow'],r['frame'])]
            px,py=round(r['sourcePivot'][0]),round(r['sourcePivot'][1])
            dx,dy=192-(px-x),272-(py-y)
            assert min(dx,dy)>=0 and dx+w<=384 and dy+h<=384,(action,r['direction'],r['frame'],dx,dy,w,h)
            bx,by,bxx,byy=r['sourceBounds'];assert x<=bx<bxx<=x+w and y<=by<byy<=y+h
            frames.append({'direction':r['direction'],'frame':r['frame'],'sourceRow':r['sourceRow'],
                           'rect':[x,y,w,h],'pivot':[px-x,py-y],
                           'bodyBounds':[bx-x,by-y,bxx-x,byy-y]})
        result['animations'][action]={'file':'../docs/design/worker-source-v01/'+action+'.png',
                 'sourceSize':[width,height],'sourceSha256':sizes[action+'.png']['sha256'],
                 'framesPerDirection':cols,'fps':a['fps'],'loop':a['loop'],
                 'compactDisplayScale':records[0]['scale'],'frames':frames}
    name='image-edit-target-3c0a833ba7a2c797.png'
    result['base']={'id':'base','file':'../docs/design/worker-source-v01/'+name,
                    'sourceSize':sizes[name]['size'],'sourceSha256':sizes[name]['sha256']}
    OUT.mkdir(exist_ok=True,parents=True)
    payload=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    (OUT/'manifest.json').write_text(payload)
    (OUT/'frames.js').write_text('/* Coordinate data only; original PNGs are never rewritten. */\n'+
                               'globalThis.HELIOSOriginalSprites = '+payload.rstrip()+';\n')
    print('Mapped 256 frames; no PNG files created or changed.')

if __name__=='__main__':build()

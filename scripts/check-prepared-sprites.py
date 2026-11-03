#!/usr/bin/env python3
"""Check the delivered asset contract, source integrity and frame bounds."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'art-source'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def check_image(path, size, palette):
    with Image.open(path) as image:
        image.load()
        assert image.mode == 'RGBA', path
        assert list(image.size) == list(size), (path,image.size,size)
        pixels=np.array(image)
    assert set(np.unique(pixels[:,:,3])) == {0,255}, path
    allowed={tuple(bytes.fromhex(c[1:])) for c in palette}
    actual={tuple(c) for c in pixels[:,:,:3][pixels[:,:,3]>0]}
    assert actual <= allowed, (path,actual-allowed)
    assert not pixels[pixels[:,:,3]==0,:3].any(), path
    return image.copy(),pixels

def main():
    source=ROOT/'docs/design/worker-source-v01'
    original=json.loads((source/'audit.json').read_text())
    for entry in original['files']:
        assert sha(source/entry['file']) == entry['sha256'], entry['file']
    m=json.loads((OUT/'worker/v01/manifest.json').read_text())
    assert m['frame']=={'width':32,'height':32}
    assert m['pivot']=={'x':16,'y':29}
    assert m['directions']==['S','N','W','E','SW','SE','NW','NE']
    result={'date':'2026-11-04','status':'prepared-not-integrated','sourceImagesUnchanged':True,
            'workerFrames':0,'animations':{},'building':{}}
    for action,a in m['animations'].items():
        path=OUT/'worker/v01'/a['file']
        assert a['sha256']==sha(path)
        assert a['sourceSha256']==sha(source/(action+'.png'))
        image,pixels=check_image(path,(32*a['frames'],256),m['palette'])
        records=m['sourceFrames'][action]
        assert len(records)==a['frames']*8
        sizes=[];ground=[];differences=[];seams=[]
        for row,direction in enumerate(m['directions']):
            frames=[]
            for col in range(a['frames']):
                frame=image.crop((col*32,row*32,(col+1)*32,(row+1)*32))
                box=frame.getbbox();assert box is not None
                assert 0<box[0]<box[2]<32 and 0<box[1]<box[3]<32,(action,row,col,box)
                record=records[row*a['frames']+col]
                assert record['bounds']==list(box) and record['direction']==direction and record['frame']==col
                sizes.append([box[2]-box[0],box[3]-box[1]])
                ground.append(box[3]);frames.append(np.array(frame))
                result['workerFrames']+=1
            changed=[int(np.any(x!=y,axis=2).sum()) for x,y in zip(frames,frames[1:])]
            differences.extend(changed)
            seams.append(int(np.any(frames[-1]!=frames[0],axis=2).sum()))
        assert any(differences), action+' is static'
        result['animations'][action]={'sheetSize':a['size'],'frames':len(records),
             'nativeBoundsWidths':[min(s[0] for s in sizes),max(s[0] for s in sizes)],
             'nativeBoundsHeights':[min(s[1] for s in sizes),max(s[1] for s in sizes)],
             'lowestOpaqueYExclusive':[min(ground),max(ground)],
             'medianChangedPixelsBetweenPoses':float(np.median(differences)),
             'loopSeamChangedPixelsByDirection':seams if a['loop'] else None,
             'allFramesInsideCanvas':True,'binaryAlpha':True,'paletteColorsUsed':len(set(map(tuple,pixels[pixels[:,:,3]>0,:3])))}
    assert result['workerFrames']==256
    b=json.loads((OUT/'base/v01/manifest.json').read_text())
    assert b['footprint']=={'width':4,'height':4,'cellPixels':24}
    assert b['pivot']=={'x':48,'y':48}
    path=OUT/'base/v01/idle.png';image,pixels=check_image(path,(96,96),b['palette'])
    assert sha(path)==b['animations']['idle']['sha256']
    assert sha(ROOT/b['source'])==b['sourceSha256']
    box=image.getbbox();assert all([box[0]>0,box[1]>0,box[2]<96,box[3]<96])
    assert not pixels[[0,-1],:,3].any() and not pixels[:,[0,-1],3].any()
    # Ensure canvas corners remain transparent, not an opaque square foundation.
    assert not pixels[:4,:4,3].any() and not pixels[-4:,-4:,3].any()
    result['building']={'id':'base','size':[96,96],'opaqueBounds':list(box),'binaryAlpha':True,
                        'allVisiblePartsInsideFootprint':True}
    (OUT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__': main()

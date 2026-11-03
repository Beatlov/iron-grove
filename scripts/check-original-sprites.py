#!/usr/bin/env python3
"""Validate original PNG integrity and coordinate-only frame manifests (stdlib)."""
from pathlib import Path
import hashlib
import json
import struct
ROOT=Path(__file__).resolve().parents[1]

def check():
    folder=ROOT/'art-source/original-v02'
    m=json.loads((folder/'manifest.json').read_text())
    js=(folder/'frames.js').read_text()
    assert json.loads(js.split('globalThis.HELIOSOriginalSprites = ',1)[1].rstrip().removesuffix(';'))==m
    assert m['pixelProcessing']=='none'
    assert m['directions']==['S','N','W','E','SW','SE','NW','NE']
    total=0
    for name,a in m['animations'].items():
        data=(ROOT/'art-source'/a['file']).resolve().read_bytes()
        assert data[:8]==b'\x89PNG\r\n\x1a\n'
        assert list(struct.unpack('>II',data[16:24]))==a['sourceSize']
        assert hashlib.sha256(data).hexdigest()==a['sourceSha256']
        n=a['framesPerDirection'];assert len(a['frames'])==8*n
        assert {r['sourceRow'] for r in a['frames']}==set(range(8))
        rows={}
        for i,r in enumerate(a['frames']):
            assert r['direction']==m['directions'][i//n] and r['frame']==i%n
            x,y,w,h=r['rect'];px,py=r['pivot'];ax,ay=m['viewport']['pivot']
            assert all(isinstance(v,int) for v in [x,y,w,h,px,py])
            assert 0<=x<x+w<=a['sourceSize'][0] and 0<=y<y+h<=a['sourceSize'][1]
            assert 0<=ax-px and ax-px+w<=m['viewport']['width']
            assert 0<=ay-py and ay-py+h<=m['viewport']['height']
            left,top,right,bottom=r['bodyBounds'];assert 0<=left<right<=w and 0<=top<bottom<=h
            rows.setdefault(r['sourceRow'],[]).append(r['rect'])
        # Each source pixel belongs to one slot: partition includes gutters and
        # low-alpha fringes, and no frame can include the neighbouring body.
        ordered=[]
        for row in range(8):
            slots=sorted(rows[row]);assert slots[0][0]==0 and slots[-1][0]+slots[-1][2]==a['sourceSize'][0]
            assert all(p[0]+p[2]==q[0] for p,q in zip(slots,slots[1:]))
            assert len({(r[1],r[3]) for r in slots})==1
            ordered.append((slots[0][1],slots[0][3]))
        assert ordered[0][0]==0 and ordered[-1][0]+ordered[-1][1]==a['sourceSize'][1]
        assert all(p[0]+p[1]==q[0] for p,q in zip(ordered,ordered[1:]))
        total+=len(a['frames'])
    assert total==256
    base=m['base'];data=(ROOT/'art-source'/base['file']).resolve().read_bytes()
    assert hashlib.sha256(data).hexdigest()==base['sourceSha256']
    report={'version':m['version'],'pixelProcessing':'none','sourcePngsUnchanged':6,
            'workerFrames':total,'sourcePixelsPartitionedExactlyOnce':True,
            'frameWindowsUnclipped':True,'metadataJsMatchesJson':True}
    (folder/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':check()

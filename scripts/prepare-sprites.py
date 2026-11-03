#!/usr/bin/env python3
"""Offline technical preparation of supplied originals; never rewrites source art.
Requires Pillow, NumPy and SciPy for this optional authoring command only.
Game and the prepared preview require none of these Python packages.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, binary_erosion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/design/worker-source-v01'
OUT = ROOT / 'art-source'
DIRECTIONS = ['S', 'N', 'W', 'E', 'SW', 'SE', 'NW', 'NE']
COUNTS = {'idle': 4, 'walk': 8, 'carry_walk': 8, 'work': 6, 'death': 6}
FPS = {'idle': 4, 'walk': 10, 'carry_walk': 10, 'work': 8, 'death': 8}
# Explicit per-sheet registration after visual review of helmet/pack direction.
ROW_MAP = {'idle': [0,1,2,3,5,4,6,7],
           'walk': list(range(8)), 'carry_walk': list(range(8)),
           'work': [0,1,3,2,5,4,6,7], 'death': [0,1,3,2,5,4,7,6]}
PALETTE = ['#101416','#20282b','#30393b','#39464d','#6d7776',
           '#87928f','#674c35','#947142','#b9ac85','#ded2ab',
           '#8d6318','#be912d','#e4aa20','#4c603d','#7c8b62',
           '#a6d23e','#ca982b']
WORKER_PALETTE = [c for c in PALETTE if c not in ['#30393b','#4c603d','#7c8b62','#a6d23e']]
COLORS = np.array([tuple(bytes.fromhex(c[1:])) for c in PALETTE], dtype=np.uint8)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def component_boxes(array):
    labels, _ = label(array[:,:,3] >= 128)
    areas = np.bincount(labels.ravel())
    slices = find_objects(labels)
    boxes = []
    for i in np.flatnonzero(areas > 500):
        if i:
            y, x = slices[i-1]
            boxes.append([x.start, y.start, x.stop, y.stop])
    return boxes


def helmet_x(a, box):
    x,y,xx,yy = box
    section = a[y:y+round((yy-y)*.38), x:xx]
    rgb = section[:,:,:3].astype(int)
    mask = ((section[:,:,3] >= 128) & (rgb[:,:,0] > 140) &
            (rgb[:,:,1] > 120) & (rgb[:,:,2] > 70) &
            (rgb[:,:,0] - rgb[:,:,2] > 10) &
            (rgb[:,:,0] - rgb[:,:,1] < 65))
    ys, xs = np.where(mask)
    if not len(xs):
        raise ValueError('Helmet registration failed')
    return x+float(np.median(xs))+.5


def palette_image(rgb, mask, palette):
    colors = np.array([tuple(bytes.fromhex(c[1:])) for c in palette], dtype=np.uint8)
    # Deterministic nearest shared color. No dither or semitransparent fringe.
    distances = ((rgb[:,:,None,:].astype(np.int32)-colors[None,None,:,:])**2).sum(axis=3)
    data = np.zeros((*mask.shape,4),dtype=np.uint8)
    data[:,:,:3] = colors[distances.argmin(axis=2)]
    data[:,:,3] = mask.astype(np.uint8)*255
    # A crisp one-native-pixel perimeter, never a frame around the whole canvas.
    border = mask & ~binary_erosion(mask)
    data[border,:3] = colors[0]
    data[~mask,:3] = 0
    return Image.fromarray(data)


def transform(array, box, pivot, scale, size, destination, palette):
    x,y,xx,yy = box
    crop = Image.fromarray(array[y:yy,x:xx].copy())
    raw = np.array(crop)
    raw[raw[:,:,3] < 128] = 0
    raw[raw[:,:,3] >= 128,3] = 255
    crop = Image.fromarray(raw)
    # Area sampling integrates source pixels before snapping to a flat palette.
    # It is authoring conversion, not runtime sprite rescaling.
    width,height = max(1,round((xx-x)*scale)),max(1,round((yy-y)*scale))
    reduced = np.array(crop.resize((width,height),Image.Resampling.BOX))
    mask = reduced[:,:,3] >= 128
    rendered = palette_image(reduced[:,:,:3],mask,palette)
    left = round(destination[0]+(x-pivot[0])*scale)
    top = round(destination[1]+(y-pivot[1])*scale)
    if not (0 <= left and 0 <= top and left+width <= size[0] and top+height <= size[1]):
        raise ValueError(f'Clipping at {left,top,width,height,size}')
    frame = Image.new('RGBA',size)
    frame.paste(rendered,(left,top))
    return frame


def prepare():
    (OUT/'worker/v01').mkdir(parents=True,exist_ok=True)
    (OUT/'base/v01').mkdir(parents=True,exist_ok=True)
    input_audit = json.loads((SOURCE/'audit.json').read_text())
    for item in input_audit['files']:
        assert sha(SOURCE/item['file']) == item['sha256'], item['file']
    manifest = {'id':'worker','version':'v01','gameVersion':'H37',
                'status':'prepared-not-integrated','frame':{'width':32,'height':32},
                'pivot':{'x':16,'y':29},'directions':DIRECTIONS,
                'layout':{'rows':'directions','columns':'time','spacing':0,'margin':0},
                'alpha':'binary','scaleProfile':'compact-current-worker',
                'palette':WORKER_PALETTE,'animations':{},'sourceFrames':{},
                'limitations':['Source motion is retained; tool silhouettes and some poses vary between source frames.',
                              'Carry_walk includes the supplied generic container; no resource-specific overlay.',
                              'No mining, sowing or harvesting-specific animations supplied.',
                              'Some death source poses rotate away from the initial heading; row names identify initial heading only.',
                              'Walking must be driven by travel distance when integrated; fps is preview only.']}
    review = Image.new('RGBA',(8*32,5*32),(0,0,0,0))
    for action,columns in COUNTS.items():
        path = SOURCE/(action+'.png')
        array = np.array(Image.open(path).convert('RGBA'))
        boxes = component_boxes(array)
        assert len(boxes) == 8*columns,(action,len(boxes))
        boxes.sort(key=lambda b:b[3])
        rows = [sorted(boxes[r*columns:(r+1)*columns],key=lambda b:b[0]) for r in range(8)]
        # One scale per complete sheet, never a per-pose stretch. Death is scaled
        # from standing first poses, so the body can fall without being enlarged.
        heights = [row[0][3]-row[0][1] for row in rows] if action=='death' else [b[3]-b[1] for row in rows for b in row]
        scale = 20/float(np.median(heights))
        sheet = Image.new('RGBA',(32*columns,256))
        mapping = ROW_MAP.get(action,list(range(8)))
        records = []
        for target_row,source_row in enumerate(mapping):
            row = rows[source_row]
            floor = float(np.median([b[3] for b in row]))
            if action == 'death':
                # Fixed regular source-cell reference, not recentering a falling
                # silhouette: retain right/left displacement and body rotation.
                centers = [(b[0]+b[2])/2 for b in row]
                pitch = float(np.median(np.diff(centers)))
                origin_x = helmet_x(array,row[0])
                floor = float(max(b[3] for b in row))
            for c,box in enumerate(row):
                # Register the helmet instead of bounding-box center: tools/cargo
                # must not push the torso sideways as they swing/appear.
                px = origin_x+c*pitch if action=='death' else helmet_x(array,box)
                frame = transform(array,box,(px,floor),scale,(32,32),(16,29),WORKER_PALETTE)
                sheet.paste(frame,(c*32,target_row*32))
                records.append({'direction':DIRECTIONS[target_row],'frame':c,
                                'sourceRow':source_row,'sourceBounds':box,
                                'sourcePivot':[round(px,4),floor],
                                'scale':scale,'bounds':list(frame.getbbox())})
                if c==0:
                    review.paste(frame,(target_row*32,list(COUNTS).index(action)*32))
        dest=OUT/'worker/v01'/(action+'.png');sheet.save(dest)
        manifest['animations'][action]={'file':dest.name,'frames':columns,'fps':FPS[action],
                                        'loop':action!='death','size':list(sheet.size),
                                        'sha256':sha(dest),'sourceSha256':sha(path)}
        manifest['sourceFrames'][action]=records
    (OUT/'worker/v01/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    review.resize((1024,640),Image.Resampling.NEAREST).save(OUT/'worker/v01/contact-x4.png')
    source=SOURCE/'image-edit-target-3c0a833ba7a2c797.png'
    array=np.array(Image.open(source).convert('RGBA'))
    boxes=component_boxes(array);assert len(boxes)==1
    box=boxes[0]
    scale=min(92/(box[2]-box[0]),92/(box[3]-box[1]))
    pivot=((box[0]+box[2])/2,(box[1]+box[3])/2)
    base=transform(array,box,pivot,scale,(96,96),(48,48),PALETTE)
    base.save(OUT/'base/v01/idle.png')
    base.resize((768,768),Image.Resampling.NEAREST).save(OUT/'base/v01/preview-x8.png')
    base_manifest={'id':'base','version':'v01','status':'prepared-not-integrated',
                   'frame':{'width':96,'height':96},'footprint':{'width':4,'height':4,'cellPixels':24},
                   'pivot':{'x':48,'y':48},'alpha':'binary','palette':PALETTE,
                   'source':str(source.relative_to(ROOT)),'sourceSha256':sha(source),
                   'sourceBounds':box,'sourcePivot':pivot,'scale':scale,
                   'animations':{'idle':{'file':'idle.png','frames':1,'loop':False,'sha256':sha(OUT/'base/v01/idle.png')}},
                   'limitations':['Only the supplied static building is prepared; no working/construction/damaged states.',
                                  'Decorations and concrete are preserved from source inside footprint.',
                                  'The supplied image has one prominent front door; game access remains four-sided.']}
    (OUT/'base/v01/manifest.json').write_text(json.dumps(base_manifest,ensure_ascii=False,indent=2)+'\n')
    print('Prepared 256 worker frames and static 96x96 command core. Source checksums unchanged.')

if __name__=='__main__':
    prepare()

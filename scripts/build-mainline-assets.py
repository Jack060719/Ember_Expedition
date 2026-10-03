"""Normalize generated batch-one art and record local runtime contracts/QC."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-source/mainline/batch-1'
RUNTIME = ROOT / 'public/assets'
report = {'generator': 'built-in image_gen', 'backgrounds': {}, 'sprites': {}, 'runtime_verified': False}
layout = {
    'width': 390, 'height': 660, 'groundDisplay': [440, 700],
    'walkBounds': {'left': 23, 'right': 367, 'top': 64, 'bottom': 602},
    'spawn': [195, 490], 'exit': [195, 68],
    'props': [{'frame': 2, 'x': 69, 'y': 265, 'w': 50, 'h': 50, 'sortY': 265},
              {'frame': 2, 'x': 319, 'y': 345, 'w': 50, 'h': 50, 'sortY': 345}],
    'blockers': [{'x': 69, 'y': 265, 'r': 15}, {'x': 319, 'y': 345, 'r': 15}],
    'propsSource': '/assets/props.png', 'foundationOnly': True,
}
for name in ['canyon', 'marsh', 'mine', 'frost-pass']:
    raw = SOURCE / name / 'raw.png'
    prompt = SOURCE / name / 'prompt-used.txt'
    assert prompt.read_text(encoding='utf-8').strip()
    image = Image.open(raw)
    original = image.size
    output = RUNTIME / f'{name}.jpg'
    image.convert('RGB').resize((1024, 1536), Image.Resampling.LANCZOS).save(output, quality=90)
    with Image.open(output) as result:
        assert result.size == (1024, 1536) and result.mode == 'RGB'
    report['backgrounds'][name] = {
        'source': f'{name}/raw.png', 'sourceSize': original,
        'prompt': f'{name}/prompt-used.txt', 'file': f'/assets/{name}.jpg',
        'size': [1024, 1536], 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }

sheet = Image.open(SOURCE / 'enemies/final/sheet-transparent.png').convert('RGBA')
assert sheet.size == (512, 256)
atlas = Image.new('RGBA', (384, 384))
order = ['sand-scorpion', 'spore-fiend', 'ember-sentinel', 'frost-hunter',
         'sand-worm', 'thorn-hive', 'furnace-colossus', 'frost-wolf']
boxes = []
for i, name in enumerate(order):
    x, y = i % 4 * 128, i // 4 * 128
    cell = sheet.crop((x, y, x+128, y+128))
    bbox = cell.getchannel('A').getbbox()
    assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 128 and bbox[3] < 128, (name, bbox)
    atlas.paste(cell, (i % 3 * 128, i // 3 * 128))
    boxes.append(bbox)
atlas.save(RUNTIME / 'enemies-mainline-1.png')
report['sprites'] = {
    'file': '/assets/enemies-mainline-1.png', 'size': [384, 384], 'cellSize': 128,
    'rows': 3, 'cols': 3, 'order': order, 'unusedFrames': [8], 'origin': [0.5, 0.78],
    'source': 'enemies/raw-spaced.png', 'prompt': 'enemies/prompt-spaced.txt',
    'pipeline': 'enemies/final/pipeline-meta.json', 'alphaBounds': boxes,
    'emptyCount': 0, 'edgeTouchCount': 0,
}
(SOURCE / 'contract.json').write_text(json.dumps({'layout': layout, **report}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Verified 4 local backgrounds and 8 transparent creature cells; runtime QA remains separate.')

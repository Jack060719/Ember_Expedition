"""Slice generated later-batch art using its saved atlas manifest; never draw game art."""
import hashlib
import json
import math
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
batch = int(sys.argv[1])
source = root / f'assets-source/mainline/batch-{batch}'
config = json.loads((source / 'sources.json').read_text(encoding='utf-8'))
ground = Image.open(source / config['ground']).convert('RGB')
w, h = ground.width // config['groundCols'], ground.height // config['groundRows']
report = {'runtime_verified': False, 'layout': json.loads((root / 'assets-source/mainline/batch-1/contract.json').read_text(encoding='utf-8'))['layout'], 'backgrounds': {}, 'enemies': config['enemies']}
for i, name in enumerate(config['backgrounds']):
    x, y = i % config['groundCols'] * w, i // config['groundCols'] * h
    output = root / f'public/assets/{name}.jpg'
    ground.crop((x, y, x+w, y+h)).resize((1024, 1536), Image.Resampling.LANCZOS).save(output, quality=90)
    report['backgrounds'][name] = {'sourceBox': [x, y, x+w, y+h], 'size': [1024, 1536], 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
meta = json.loads((source / 'enemies/accepted/pipeline-meta.json').read_text(encoding='utf-8'))
assert not meta['source_edge_touch_frames'] and not meta['output_edge_touch_frames'] and not meta['empty_frames'] and not meta['paste_clamped_frames']
sheet = Image.open(source / 'enemies/accepted/sheet-transparent.png').convert('RGBA')
atlas = Image.new('RGBA', (384, math.ceil(len(config['enemies']) / 3) * 128))
for i, name in enumerate(config['enemies']):
    x, y = i % meta['cols'] * 128, i // meta['cols'] * 128
    cell = sheet.crop((x, y, x+128, y+128))
    bounds = cell.getchannel('A').getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < 128 and bounds[3] < 128, name
    atlas.paste(cell, (i % 3 * 128, i // 3 * 128))
atlas.save(root / f'public/assets/enemies-mainline-{batch}.png')
report['atlas'] = {'size': list(atlas.size), 'cellSize': 128, 'origin': [.5, .78], 'source': 'enemies/accepted/sheet-transparent.png'}
(source / 'contract.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Batch {batch}: verified {len(config["backgrounds"])} backgrounds and {len(config["enemies"])} enemy cells; runtime inspection remains separate.')

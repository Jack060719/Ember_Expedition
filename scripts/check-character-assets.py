"""Verify the runtime character sheets and their processing records (requires Pillow)."""
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DIRECTIONS = ["down", "left", "right", "up"]


def inspect_sheet(path):
    with Image.open(path) as sheet:
        sheet.load()
        assert sheet.size == (512, 512), (path, sheet.size)
        assert sheet.mode == "RGBA", (path, sheet.mode)
        heights = []
        for index in range(16):
            x, y = index % 4 * 128, index // 4 * 128
            frame = sheet.crop((x, y, x + 128, y + 128))
            box = frame.getchannel("A").getbbox()
            assert box is not None, (path, index, "empty frame")
            left, top, right, bottom = box
            assert 0 < left < right < 128 and 0 < top < bottom < 128, (path, index, box)
            pixels = frame.tobytes()
            assert not any(pixels[i] > 200 and pixels[i + 2] > 200 and pixels[i + 1] < 60 and pixels[i + 3] > 128
                           for i in range(0, len(pixels), 4)), (path, index, "magenta background remains")
            heights.append(bottom - top)
        return sum(heights) / 16


reference_height = inspect_sheet(ROOT / "public/assets/hero.png")
for character in ["scout", "warden"]:
    source = ROOT / "assets-source/characters" / character
    runtime = ROOT / "public/assets/characters" / f"{character}.png"
    height = inspect_sheet(runtime)
    assert abs(height / reference_height - 1) <= .15, (character, "scale differs from keeper", height)
    assert runtime.read_bytes() == (source / "sheet-transparent.png").read_bytes()
    assert (source / "prompt-used.txt").read_text(encoding="utf-8").strip()
    meta = json.loads((source / "pipeline-meta.json").read_text(encoding="utf-8"))
    assert (meta["rows"], meta["cols"], meta["cell_size"]) == (4, 4, 128)
    assert meta["directions"] == DIRECTIONS
    assert meta["output_origin"] == [64, 116]
    qc = meta["qc_summary"]
    assert qc["frame_count"] == qc["valid_frame_count"] == 16
    assert qc["empty_count"] == qc["edge_touch_count"] == qc["paste_clamped_count"] == 0
    assert qc["body_scale_cv"] <= .08 and qc["anchor_y_std"] <= .05
    with Image.open(source / "sheet-transparent.png") as sheet:
        for label in meta["frame_labels"]:
            with Image.open(source / f"{label}.png") as frame:
                frame.load()
                assert frame.size == (128, 128)
                assert frame.getchannel("A").getbbox() is not None
        for row, direction in enumerate(DIRECTIONS):
            with Image.open(source / f"{direction}-strip.png") as strip:
                assert strip.size == (512, 128)
                assert strip.convert("RGBA").tobytes() == sheet.crop((0, row * 128, 512, row * 128 + 128)).tobytes()
            with Image.open(source / f"{direction}.gif") as preview:
                assert preview.n_frames == 4
                for index in range(preview.n_frames):
                    preview.seek(index)
                    preview.load()
    with Image.open(source / "raw.png") as raw:
        raw.load()
    print(f"PASS {character}: 16 frames, transparent, aligned, mean height {height:.2f}px")

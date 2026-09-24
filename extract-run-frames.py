"""Extract six consistent transparent quadruped frames from a generated strip."""

from pathlib import Path
import cv2
import numpy as np
from PIL import Image


source = Path(__file__).parent / "art" / "mascot-run-strip.png"
output = Path(__file__).parent / "dist"
rgba = np.array(Image.open(source).convert("RGBA"))
opaque = (rgba[:, :, 3] > 50).astype(np.uint8)
count, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, 8)
parts = sorted(
    (index for index in range(1, count) if stats[index, cv2.CC_STAT_AREA] > 30000),
    key=lambda index: stats[index, cv2.CC_STAT_LEFT],
)
if len(parts) != 6:
    raise SystemExit(f"Expected six complete characters; found {len(parts)}")

for frame, index in enumerate(parts, 1):
    x, y, width, height, _ = stats[index]
    border = 8
    left = max(0, x - border)
    top = max(0, y - border)
    right = min(rgba.shape[1], x + width + border)
    bottom = min(rgba.shape[0], y + height + border)
    region = rgba[top:bottom, left:right].copy()
    region_mask = (labels[top:bottom, left:right] == index).astype(np.uint8)
    region_mask = cv2.dilate(region_mask, np.ones((7, 7), np.uint8), iterations=1)
    region[:, :, 3] *= region_mask

    image = Image.fromarray(region, "RGBA")
    scale = min(420 / image.width, 400 / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((512 - image.width) // 2, 452 - image.height))
    canvas.save(output / f"mascot-run-{frame}.png")

print("Extracted", len(parts), "frames")

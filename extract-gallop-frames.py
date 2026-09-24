"""Cut the four right-facing gallop poses into aligned transparent sprites."""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


root = Path(__file__).parent
source = root / "art" / "mascot-gallop-strip-v2.png"
output = root / "dist"
rgba = np.array(Image.open(source).convert("RGBA"))
opaque = (rgba[:, :, 3] > 50).astype(np.uint8)
count, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, 8)
parts = sorted(
    (index for index in range(1, count) if stats[index, cv2.CC_STAT_AREA] > 30000),
    key=lambda index: stats[index, cv2.CC_STAT_LEFT],
)
if len(parts) != 4:
    raise SystemExit(f"Expected four complete gallop poses; found {len(parts)}")

max_width = max(stats[index, cv2.CC_STAT_WIDTH] for index in parts)
max_height = max(stats[index, cv2.CC_STAT_HEIGHT] for index in parts)
scale = min(460 / max_width, 390 / max_height)
ground_lines = (456, 446, 420, 454)

for frame, index in enumerate(parts, 1):
    x, y, width, height, _ = stats[index]
    border = 7
    left = max(0, x - border)
    top = max(0, y - border)
    right = min(rgba.shape[1], x + width + border)
    bottom = min(rgba.shape[0], y + height + border)
    region = rgba[top:bottom, left:right].copy()
    region_mask = (labels[top:bottom, left:right] == index).astype(np.uint8)
    region_mask = cv2.dilate(region_mask, np.ones((7, 7), np.uint8), iterations=1)
    region[:, :, 3] *= region_mask

    image = Image.fromarray(region, "RGBA")
    image = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((512 - image.width) // 2, ground_lines[frame - 1] - image.height))
    canvas.save(output / f"mascot-gallop-{frame}-v2.png")

print("Extracted", len(parts), "gallop poses")

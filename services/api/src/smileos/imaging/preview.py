"""Smile preview: whitening confined to the teeth.

Classical color-space segmentation (NumPy + SciPy, no GPU, no model download):

1. Convert sRGB → CIE L*a*b*.
2. Lips: strongly red pixels (high a*); the dominant blobs and the space they enclose
   define the mouth region.
3. Tooth candidates: bright, low-chroma pixels; yellow tint (b*) is allowed.
4. Teeth = tooth candidates inside the mouth region. This excludes background,
   eye whites and skin highlights.
5. Feather the mask, then raise L* and pull b* toward neutral only inside it.

If no plausible tooth region is found, the original image is returned with `applied=False`.
The UI then says so instead of showing a whitened face.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import cast

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

METHOD = "lab-mask-v1"

# D65 reference white
_XN, _YN, _ZN = 0.95047, 1.0, 1.08883
_M_RGB2XYZ = np.array(
    [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]]
)
_M_XYZ2RGB = np.linalg.inv(_M_RGB2XYZ)


def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    xyz = _srgb_to_linear(rgb / 255.0) @ _M_RGB2XYZ.T
    xyz /= (_XN, _YN, _ZN)
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], axis=-1)
    xyz = np.where(f**3 > 216 / 24389, f**3, (116 * f - 16) / (24389 / 27)) * (_XN, _YN, _ZN)
    rgb = _linear_to_srgb(xyz @ _M_XYZ2RGB.T)
    return np.clip(rgb * 255.0, 0, 255)


@dataclass(frozen=True, slots=True)
class PreviewResult:
    image: bytes
    applied: bool
    mask_coverage: float
    method: str = METHOD


def _mask_image(mask: np.ndarray) -> Image.Image:
    return Image.fromarray((mask * 255).astype(np.uint8), mode="L")


def _label(mask: np.ndarray, *, connectivity8: bool = False) -> tuple[np.ndarray, int]:
    structure = np.ones((3, 3)) if connectivity8 else None
    return cast(tuple[np.ndarray, int], ndimage.label(mask, structure=structure))


def _box(labels: np.ndarray, index: int) -> tuple[slice, slice]:
    return cast(tuple[slice, slice], ndimage.find_objects(labels)[index])


def _region_around(labels: np.ndarray, boxes: list, sizes: np.ndarray, anchor: int) -> np.ndarray:
    """Mouth region anchored on lip blob `anchor`: the blob, aligned near-touching blobs, and
    the space they enclose (closing joins mouth corners, hole-filling recovers the opening).
    Falls back to the bounding box when the lips don't form a ring, e.g. in profile shots."""
    ys, xs = cast(tuple[slice, slice], boxes[anchor])
    max_gap = max(3, int(0.1 * (ys.stop - ys.start)))

    def _aligned(by: slice, bx: slice, size: float) -> bool:
        overlap = min(bx.stop, xs.stop) - max(bx.start, xs.start)
        gap = max(by.start - ys.stop, ys.start - by.stop, 0)
        return size >= sizes[anchor] * 0.15 and overlap >= 0.5 * (bx.stop - bx.start) and gap <= max_gap

    keep = [
        i + 1 for i, (box, size) in enumerate(zip(boxes, sizes, strict=True)) if box and _aligned(box[0], box[1], size)
    ]
    selected = np.isin(labels, keep)

    radius = max(2, int(min(labels.shape) * 0.02))
    disk = np.hypot(*np.ogrid[-radius : radius + 1, -radius : radius + 1]) <= radius
    filled = np.asarray(ndimage.binary_fill_holes(ndimage.binary_closing(selected, structure=disk)), dtype=bool)
    if (filled & ~selected).sum() >= 0.2 * selected.sum():
        return filled
    region = np.zeros(labels.shape, dtype=bool)
    region[_box(selected.astype(np.int8), 0)] = True
    return region


def _mouth_region(lips: np.ndarray, candidates: np.ndarray, max_anchors: int = 4) -> np.ndarray | None:
    """The largest red blob is not always the mouth (cheek blush, ears), so try the biggest few
    as anchors and keep the region that encloses the most tooth-coloured pixels."""
    labels, n = _label(lips, connectivity8=True)
    if n == 0:
        return None
    sizes = ndimage.sum_labels(lips, labels, index=np.arange(1, n + 1))
    boxes = ndimage.find_objects(labels)
    anchors = [i for i in np.argsort(sizes)[::-1][:max_anchors] if sizes[i] >= lips.size * 0.001]
    best, best_score = None, 0
    for anchor in anchors:
        region = _region_around(labels, boxes, sizes, int(anchor))
        score = int((candidates & region).sum())
        if score > best_score:
            best, best_score = region, score
    return best


def tooth_mask(rgb: np.ndarray) -> np.ndarray:
    lab = rgb_to_lab(rgb.astype(np.float64))
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Calibrated on sample photos: teeth sit near a*≈0, skin at a*≈10-25, lips at a*≥25.
    lips = (a > 24) & (L > 25) & (L < 88)
    candidates = (L > 58) & (a < 7) & (b > -6) & (b < 32) & (np.hypot(a, b) < 30)

    region = _mouth_region(lips, candidates)
    if region is None:
        return np.zeros_like(candidates)
    teeth = candidates & region

    # Keep the substantial blobs only; specks inside the region are reflections or noise.
    labels, n = _label(teeth)
    if n == 0:
        return teeth
    sizes = ndimage.sum_labels(teeth, labels, index=np.arange(1, n + 1))
    keep = np.flatnonzero(sizes >= sizes.max() * 0.05) + 1
    return np.isin(labels, keep)


def whiten(jpeg_bytes: bytes, *, strength: float = 1.0) -> PreviewResult:
    img = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
    rgb = np.asarray(img, dtype=np.float64)
    mask = tooth_mask(rgb)
    coverage = float(mask.mean())

    # A real mouth covers a small but non-trivial part of a smile photo.
    if not 0.002 <= coverage <= 0.25:
        return PreviewResult(image=jpeg_bytes, applied=False, mask_coverage=round(coverage, 4))

    soft = np.asarray(_mask_image(mask).filter(ImageFilter.GaussianBlur(2)), dtype=np.float64) / 255.0
    soft = soft[..., None] * strength
    lab = rgb_to_lab(rgb)
    target = lab.copy()
    target[..., 0] = lab[..., 0] + (100 - lab[..., 0]) * 0.22
    target[..., 1] = lab[..., 1] * 0.6
    target[..., 2] = lab[..., 2] * 0.35
    out = lab_to_rgb(lab * (1 - soft) + target * soft)

    buf = io.BytesIO()
    Image.fromarray(out.astype(np.uint8)).save(buf, format="JPEG", quality=90)
    return PreviewResult(image=buf.getvalue(), applied=True, mask_coverage=round(coverage, 4))

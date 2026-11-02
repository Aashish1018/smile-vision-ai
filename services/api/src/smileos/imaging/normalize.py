"""Upload normalization: decode, honour EXIF orientation, resize, re-encode.

Re-encoding drops all metadata, including EXIF GPS coordinates, so stored patient photos
never carry location data.
"""

from __future__ import annotations

import io

from PIL import Image, ImageOps, UnidentifiedImageError

from smileos.core.errors import BadRequest

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}


def normalize_photo(raw: bytes, *, max_side: int) -> bytes:
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = img.format
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise BadRequest("Please upload a JPEG, PNG or WebP photo.", detail=str(exc)) from exc
    if fmt not in ALLOWED_FORMATS:
        raise BadRequest("Please upload a JPEG, PNG or WebP photo.", detail=f"format={fmt}")
    if min(img.size) < 256:
        raise BadRequest("The photo is too small. Please use at least 256×256 pixels.")

    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90)
    return out.getvalue()

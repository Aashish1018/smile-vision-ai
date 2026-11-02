"""Preview whitening on synthetic images with known geometry."""

import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from smileos.core.errors import BadRequest
from smileos.imaging.normalize import normalize_photo
from smileos.imaging.preview import lab_to_rgb, rgb_to_lab, tooth_mask, whiten

SKIN = (224, 180, 150)
LIPS = (190, 70, 80)
TEETH = (235, 222, 180)  # yellowish enamel


def _jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def synthetic_smile() -> Image.Image:
    img = Image.new("RGB", (600, 600), SKIN)
    d = ImageDraw.Draw(img)
    d.ellipse((150, 260, 450, 400), fill=LIPS)  # lips
    d.ellipse((185, 290, 415, 370), fill=(40, 20, 20))  # mouth opening
    d.rectangle((200, 300, 400, 340), fill=TEETH)  # teeth
    d.ellipse((20, 20, 80, 60), fill=(245, 245, 240))  # a bright, low-chroma highlight far from the mouth
    return img


def test_lab_roundtrip():
    rgb = np.random.default_rng(0).uniform(0, 255, (16, 16, 3))
    assert np.allclose(lab_to_rgb(rgb_to_lab(rgb)), rgb, atol=0.5)


def test_mask_finds_teeth_and_ignores_far_highlights():
    rgb = np.asarray(synthetic_smile(), dtype=np.float64)
    mask = tooth_mask(rgb)
    assert mask[320, 300]  # middle of the teeth
    assert not mask[40, 50]  # bright highlight outside the mouth
    assert not mask[100, 300]  # skin


def test_whitening_reduces_yellow_only_inside_mask():
    original = synthetic_smile()
    result = whiten(_jpeg(original))
    assert result.applied
    assert 0.002 < result.mask_coverage < 0.25
    out = np.asarray(Image.open(io.BytesIO(result.image)), dtype=np.float64)
    src = np.asarray(original, dtype=np.float64)
    before_b, after_b = rgb_to_lab(src[320, 300])[2], rgb_to_lab(out[320, 300])[2]
    assert after_b < before_b - 5  # less yellow
    assert np.abs(out[100, 300] - src[100, 300]).max() < 8  # skin unchanged (JPEG noise only)


def test_no_mouth_means_no_preview():
    result = whiten(_jpeg(Image.new("RGB", (400, 400), (250, 250, 250))))
    assert not result.applied
    assert result.mask_coverage == 0


def test_normalize_strips_metadata_and_resizes():
    img = Image.new("RGB", (3000, 2000), SKIN)
    exif = Image.Exif()
    exif[0x8825] = {2: (12, 34, 56)}  # GPSInfo
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    out = Image.open(io.BytesIO(normalize_photo(buf.getvalue(), max_side=1280)))
    assert max(out.size) == 1280
    assert not out.getexif()


@pytest.mark.parametrize("payload", [b"not an image", _jpeg(Image.new("RGB", (100, 100)))])
def test_normalize_rejects_bad_uploads(payload):
    with pytest.raises(BadRequest):
        normalize_photo(payload, max_side=1280)

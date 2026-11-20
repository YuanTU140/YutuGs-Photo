import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image, ImageCms
from app import open_profile, convert_rgb_to_cmyk, limit_total_ink, profile_info


def test_lcms_rgb_to_cmyk_with_real_output_profile():
    profile_path = Path('/usr/share/texlive/texmf-dist/tex/generic/colorprofiles/FOGRA39L_coated.icc')
    if not profile_path.exists():
        profile_path = Path('/usr/share/color/icc/ghostscript/default_cmyk.icc')
    if not profile_path.exists():
        return
    data = profile_path.read_bytes()
    output = open_profile(data, 'test output')
    assert output.profile.xcolor_space.strip() == 'CMYK'
    source = ImageCms.createProfile('sRGB')
    rgb = Image.new('RGB', (8, 8), (210, 80, 45))
    cmyk = convert_rgb_to_cmyk(rgb, source, output, 1, True)
    assert cmyk.mode == 'CMYK'
    assert cmyk.size == rgb.size
    assert profile_info(output, data)['sha256']


def test_total_ink_limiter_preserves_black_and_caps_channels():
    image = Image.new('CMYK', (1, 1), (255, 255, 255, 80))
    result, report = limit_total_ink(image, 220)
    c, m, y, k = result.getpixel((0, 0))
    assert k == 80
    assert c + m + y + k <= 220 * 255 / 100 + 3
    assert report['limit_percent'] == 220

def test_total_ink_report_includes_post_limit_coverage():
    image = Image.new('CMYK', (2, 2), (255, 255, 255, 80))
    result, report = limit_total_ink(image, 220)
    assert report['max_tac_before'] > 220
    assert report['max_tac_after'] <= 220.1
    assert result.mode == 'CMYK'

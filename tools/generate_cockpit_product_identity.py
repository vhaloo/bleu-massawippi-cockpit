"""Build the Cockpit product lockup from the verified 2024 Bleu Massawippi logo.

The official artwork is never redrawn. This script crops only transparent padding,
then embeds the exact pixels in a product lockup and in maskable PWA icons.
"""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / "cockpit" / "assets" / "brand"
SOURCE = BRAND_DIR / "logo-bleu-massawippi-2024.png"
LOCKUP = BRAND_DIR / "cockpit-bleu-massawippi-lockup.svg"
ICON_512 = BRAND_DIR / "cockpit-bleu-massawippi-icon-512.png"
ICON_192 = BRAND_DIR / "cockpit-bleu-massawippi-icon-192.png"
ICON_SVG = ROOT / "cockpit" / "icon.svg"

NAVY = "#073a52"
BLUE = "#0756a1"
CYAN = "#078bc8"
TEAL = "#2ab6bb"
WHITE = "#ffffff"


def png_data_uri(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def load_official_logo() -> tuple[Image.Image, Image.Image]:
    source = Image.open(SOURCE).convert("RGBA")
    if source.getpixel((0, 0))[3] != 0:
        raise RuntimeError("Le logo officiel doit conserver son fond transparent.")
    bounds = source.getbbox()
    if not bounds:
        raise RuntimeError("Le logo officiel est vide.")
    return source, source.crop(bounds)


def build_lockup(official_crop: Image.Image) -> None:
    logo_uri = png_data_uri(official_crop)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 410" role="img" aria-labelledby="title desc">
  <title id="title">Cockpit Bleu Massawippi</title>
  <desc id="desc">Signature produit combinant le logo officiel de Bleu Massawippi et le nom Cockpit.</desc>
  <image href="{logo_uri}" x="24" y="34" width="390" height="332" preserveAspectRatio="xMidYMid meet"/>
  <rect x="454" y="55" width="5" height="300" rx="2.5" fill="{TEAL}"/>
  <text x="510" y="186" fill="{NAVY}" font-family="Segoe UI, Arial, sans-serif" font-size="116" font-weight="800" letter-spacing="3">COCKPIT</text>
  <text x="516" y="246" fill="{BLUE}" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" letter-spacing="1.5">BLEU MASSAWIPPI</text>
  <path d="M516 278 H1055" stroke="{CYAN}" stroke-width="4" stroke-linecap="round"/>
  <text x="516" y="324" fill="{NAVY}" opacity=".78" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="600" letter-spacing=".8">Coordination des communications</text>
</svg>
'''
    LOCKUP.write_text(svg, encoding="utf-8", newline="\n")


def fitted_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def build_icons(official: Image.Image) -> None:
    canvas = Image.new("RGBA", (512, 512), NAVY)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((44, 44, 468, 468), radius=98, fill=WHITE)

    # This crop contains only the official water-and-mountain symbol; it does
    # not redraw or reinterpret the registered artwork.
    symbol = official.crop((330, 62, 1140, 654))
    # The official wordmark begins below the main symbol. Remove only the tiny
    # overlap at the lower-left edge of this crop while keeping both flourishes.
    ImageDraw.Draw(symbol).rectangle((0, 505, 92, 592), fill=(0, 0, 0, 0))
    symbol.thumbnail((360, 285), Image.Resampling.LANCZOS)
    canvas.alpha_composite(symbol, ((512 - symbol.width) // 2, 82))

    label_font = fitted_font(r"C:\Windows\Fonts\segoeuib.ttf", 42)
    label = "COCKPIT"
    label_box = draw.textbbox((0, 0), label, font=label_font)
    label_width = label_box[2] - label_box[0]
    draw.rounded_rectangle((118, 388, 394, 447), radius=27, fill=NAVY)
    draw.text(((512 - label_width) / 2, 393), label, fill=WHITE, font=label_font)
    draw.rounded_rectangle((204, 460, 308, 468), radius=4, fill=TEAL)

    canvas.save(ICON_512, format="PNG", optimize=True)
    canvas.resize((192, 192), Image.Resampling.LANCZOS).save(ICON_192, format="PNG", optimize=True)

    icon_uri = png_data_uri(canvas)
    ICON_SVG.write_text(
        f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Cockpit Bleu Massawippi</title>
  <desc id="desc">Icône du cockpit fondée sur le symbole officiel de Bleu Massawippi.</desc>
  <image href="{icon_uri}" width="512" height="512"/>
</svg>
''',
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    official, official_crop = load_official_logo()
    build_lockup(official_crop)
    build_icons(official)
    for path in (LOCKUP, ICON_512, ICON_192, ICON_SVG):
        if not path.exists() or path.stat().st_size < 1_000:
            raise RuntimeError(f"Actif incomplet : {path}")
        print(f"{path.relative_to(ROOT)}\t{path.stat().st_size} octets")


if __name__ == "__main__":
    main()

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

SOURCE = Path(r"C:\Users\Vhaloo\Downloads\384ab867-4072-429d-9ee2-856454090365.jpeg")
OUTPUT = Path(r"C:\Users\Vhaloo\Documents\Bleu Massawippi\Images\2026-07-13-portes-ouvertes-saint-barthelemy-v03.jpg")
LOGO = Path(r"C:\Users\Vhaloo\Documents\Bleu Massawippi\Images\Branding\logo-bleu-massawippi-2024.png")
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")

W, H, PHOTO_H = 1080, 1350, 720
NAVY, AQUA, IVORY, INK, SOFT = "#073a52", "#2497aa", "#f8f3e8", "#163846", "#58717a"

source = Image.open(SOURCE).convert("RGB")
photo = ImageOps.fit(source, (W, PHOTO_H), method=Image.Resampling.LANCZOS, centering=(0.55, 0.52))
canvas = Image.new("RGB", (W, H), IVORY)
canvas.paste(photo, (0, 0))
draw = ImageDraw.Draw(canvas)
draw.rectangle((0, PHOTO_H - 10, W, PHOTO_H + 10), fill=AQUA)

def font(size, bold=False):
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT), size)

if LOGO.exists():
    logo = Image.open(LOGO).convert("RGBA")
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)
        logo.thumbnail((165, 94), Image.Resampling.LANCZOS)
        canvas.paste(logo, (W - logo.width - 55, PHOTO_H + 35), logo)

x, y = 58, PHOTO_H + 38
draw.text((x, y), "PORTES OUVERTES", font=font(59, True), fill=NAVY)
y += 72
draw.text((x, y), "Venez nous rencontrer", font=font(30), fill=AQUA)
y += 63

rows = [
    ("LUNDI 13 JUILLET", "8 H 30 — 16 H"),
    ("MERCREDI 15 JUILLET", "8 H 30 — 15 H"),
    ("JEUDI 16 JUILLET", "8 H 30 — 16 H"),
]
for day, hours in rows:
    draw.rounded_rectangle((x, y, W - 58, y + 62), radius=14, fill="#ffffff", outline="#d5e5e4", width=2)
    draw.text((x + 18, y + 16), day, font=font(23, True), fill=INK)
    hours_box = draw.textbbox((0, 0), hours, font=font(23, True))
    draw.text((W - 78 - (hours_box[2] - hours_box[0]), y + 16), hours, font=font(23, True), fill=NAVY)
    y += 73

y += 9
draw.text((x, y), "ÉGLISE SAINT-BARTHÉLEMY", font=font(28, True), fill=NAVY)
y += 42
draw.text((x, y), "911, RUE CLOUGH · AYER’S CLIFF", font=font(24), fill=INK)
y += 55
draw.rounded_rectangle((x, y, x + 235, y + 49), radius=24, fill=AQUA)
draw.text((x + 23, y + 12), "ENTRÉE LIBRE", font=font(22, True), fill="white")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
canvas.save(OUTPUT, "JPEG", quality=91, optimize=True, progressive=True)
print(OUTPUT)

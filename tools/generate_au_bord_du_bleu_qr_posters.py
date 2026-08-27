#!/usr/bin/env python3
"""Generate the two US Letter QR posters used at Au bord du bleu.

The output is deliberately vector-first: typography, rules, lake motifs and QR
codes are drawn programmatically.  No generated image is used.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


NAVY = colors.HexColor("#073A52")
BLUE = colors.HexColor("#087EC0")
TEAL = colors.HexColor("#2497AA")
PALE_BLUE = colors.HexColor("#EAF6FA")
PALE_GOLD = colors.HexColor("#FFF7E5")
GOLD = colors.HexColor("#D8A53B")
INK = colors.HexColor("#173F4E")
MUTED = colors.HexColor("#5A7680")
WHITE = colors.white

PAGE_W, PAGE_H = letter
MARGIN = 48


def register_fonts() -> None:
    fonts = {
        "BM-Regular": Path(r"C:\Windows\Fonts\arial.ttf"),
        "BM-Bold": Path(r"C:\Windows\Fonts\arialbd.ttf"),
        "BM-Italic": Path(r"C:\Windows\Fonts\ariali.ttf"),
    }
    for name, path in fonts.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))


def draw_wave(c: canvas.Canvas, x: float, y: float, width: float, amplitude: float = 5) -> None:
    p = c.beginPath()
    segments = 4
    segment = width / segments
    p.moveTo(x, y)
    for i in range(segments):
        sx = x + i * segment
        p.curveTo(
            sx + segment * 0.25,
            y + amplitude,
            sx + segment * 0.75,
            y - amplitude,
            sx + segment,
            y,
        )
    c.drawPath(p, stroke=1, fill=0)


def draw_brand_motif(c: canvas.Canvas, center_x: float, center_y: float) -> None:
    c.saveState()
    c.setStrokeColor(colors.Color(0.03, 0.49, 0.75, alpha=0.38))
    c.setLineWidth(0.8)
    for radius in (44, 66, 96):
        c.circle(center_x, center_y, radius, stroke=1, fill=0)
    c.setDash(1.5, 3.2)
    c.line(center_x - 115, center_y + 60, center_x + 112, center_y - 78)
    c.line(center_x - 85, center_y - 84, center_x + 80, center_y + 102)
    c.setDash()
    for dx, dy, radius in ((-85, 60, 4), (-42, 35, 3), (0, 0, 5), (54, -34, 3), (92, -72, 4), (78, 96, 3)):
        c.setFillColor(colors.Color(0.03, 0.49, 0.75, alpha=0.58))
        c.circle(center_x + dx, center_y + dy, radius, stroke=0, fill=1)
    c.setStrokeColor(colors.Color(0.03, 0.49, 0.75, alpha=0.52))
    for offset in (0, -11, -22):
        draw_wave(c, center_x - 70, center_y + 78 + offset, 140, 4)
    c.restoreState()


def draw_logo(c: canvas.Canvas, logo_path: Path) -> None:
    if not logo_path.exists():
        return
    image = ImageReader(str(logo_path))
    iw, ih = image.getSize()
    max_w, max_h = 128, 72
    scale = min(max_w / iw, max_h / ih)
    w, h = iw * scale, ih * scale
    c.drawImage(image, PAGE_W - MARGIN - w, PAGE_H - 48 - h, width=w, height=h, mask="auto")


def draw_qr(c: canvas.Canvas, value: str, x: float, y: float, size: float) -> None:
    qr = QrCodeWidget(value)
    bounds = qr.getBounds()
    qr_w = bounds[2] - bounds[0]
    qr_h = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / qr_w, 0, 0, size / qr_h, 0, 0])
    drawing.add(qr)
    c.setFillColor(WHITE)
    c.roundRect(x - 9, y - 9, size + 18, size + 18, 8, fill=1, stroke=0)
    renderPDF.draw(drawing, c, x, y)


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(c: canvas.Canvas, text: str, x: float, y: float, width: float, *, font: str = "BM-Regular", size: float = 10.5, leading: float = 14, color=INK) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_lines(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def header(c: canvas.Canvas, logo_path: Path, eyebrow: str) -> None:
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.setFont("BM-Bold", 10.5)
    c.drawString(MARGIN, PAGE_H - 57, eyebrow.upper())
    draw_logo(c, logo_path)
    c.setStrokeColor(BLUE)
    c.setLineWidth(4)
    c.line(MARGIN, PAGE_H - 84, MARGIN + 180, PAGE_H - 84)
    c.setStrokeColor(NAVY)
    c.line(MARGIN + 189, PAGE_H - 84, MARGIN + 232, PAGE_H - 84)


def footer(c: canvas.Canvas) -> None:
    c.setStrokeColor(colors.HexColor("#C8E3EA"))
    c.setLineWidth(0.7)
    c.line(MARGIN, 42, PAGE_W - MARGIN, 42)
    c.setFillColor(MUTED)
    c.setFont("BM-Regular", 7.6)
    c.drawString(MARGIN, 28, "BLEU MASSAWIPPI · INFORMER · ÉDUQUER · INFLUENCER · AGIR")
    c.drawRightString(PAGE_W - MARGIN, 28, "bleumassawippi.com")


def make_donation(output: Path, logo_path: Path, url: str) -> None:
    c = canvas.Canvas(str(output), pagesize=letter, pageCompression=1)
    c.setTitle("Soutenez Bleu Massawippi — affiche de dons Zeffy")
    c.setAuthor("Bleu Massawippi")
    c.setSubject("Affiche bilingue avec code QR pour faire un don sécurisé à Bleu Massawippi sur Zeffy")
    header(c, logo_path, "Au bord du bleu · 30 août 2026")
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 31)
    c.drawString(MARGIN, PAGE_H - 132, "UN GESTE")
    c.drawString(MARGIN, PAGE_H - 168, "POUR LE LAC")
    c.setFillColor(BLUE)
    c.setFont("BM-Regular", 16)
    c.drawString(MARGIN, PAGE_H - 196, "A gift for the lake")
    draw_brand_motif(c, PAGE_W - 128, PAGE_H - 230)

    c.setFillColor(PALE_BLUE)
    c.roundRect(MARGIN, 365, PAGE_W - 2 * MARGIN, 168, 12, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 13)
    c.drawString(MARGIN + 18, 505, "SOUTENEZ BLEU MASSAWIPPI")
    y = paragraph(
        c,
        "Votre don soutient une mission concrète : informer, éduquer, influencer et agir pour la qualité de l’eau, la santé du lac Massawippi et la qualité de vie de ses résidents et utilisateurs.",
        MARGIN + 18,
        482,
        PAGE_W - 2 * MARGIN - 36,
        size=10.2,
        leading=13.2,
    )
    c.setFillColor(TEAL)
    c.setLineWidth(1)
    c.line(MARGIN + 18, y - 3, PAGE_W - MARGIN - 18, y - 3)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 11)
    c.drawString(MARGIN + 18, y - 23, "SUPPORT BLEU MASSAWIPPI")
    paragraph(
        c,
        "Your donation supports a practical mission: informing, educating, influencing and acting to protect water quality, Lake Massawippi’s health and the quality of life of its residents and users.",
        MARGIN + 18,
        y - 42,
        PAGE_W - 2 * MARGIN - 36,
        size=9.5,
        leading=12.2,
    )

    qr_size = 174
    qr_x, qr_y = PAGE_W - MARGIN - qr_size, 126
    draw_qr(c, url, qr_x, qr_y, qr_size)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 16)
    c.drawString(MARGIN, 284, "SCANNEZ POUR DONNER")
    c.setFont("BM-Regular", 12)
    c.drawString(MARGIN, 263, "Scan to donate")
    c.setFont("BM-Bold", 10.5)
    c.setFillColor(BLUE)
    c.drawString(MARGIN, 229, "PAIEMENT SÉCURISÉ AVEC ZEFFY")
    c.setFont("BM-Regular", 9.5)
    c.setFillColor(INK)
    c.drawString(MARGIN, 212, "Secure donation through Zeffy")
    c.setFillColor(PALE_GOLD)
    c.roundRect(MARGIN, 153, 264, 39, 8, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 10)
    c.drawString(MARGIN + 13, 170, "MERCI DE PRENDRE SOIN DU LAC")
    c.setFont("BM-Regular", 8.5)
    c.drawString(MARGIN + 13, 158, "Thank you for caring for the lake")
    footer(c)
    c.showPage()
    c.save()


def make_upload(output: Path, logo_path: Path, url: str) -> None:
    c = canvas.Canvas(str(output), pagesize=letter, pageCompression=1)
    c.setTitle("Partagez vos photos et vidéos — Au bord du bleu")
    c.setAuthor("Bleu Massawippi")
    c.setSubject("Affiche bilingue avec code QR pour transmettre des photos et vidéos à Bleu Massawippi")
    header(c, logo_path, "Au bord du bleu · 30 août 2026")
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 28)
    c.drawString(MARGIN, PAGE_H - 132, "PARTAGEZ VOS")
    c.drawString(MARGIN, PAGE_H - 166, "PHOTOS ET VIDÉOS")
    c.setFillColor(BLUE)
    c.setFont("BM-Regular", 15)
    c.drawString(MARGIN, PAGE_H - 194, "Share your photos and videos")
    draw_brand_motif(c, PAGE_W - 128, PAGE_H - 230)

    c.setFillColor(PALE_BLUE)
    c.roundRect(MARGIN, 373, PAGE_W - 2 * MARGIN, 158, 12, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 12.5)
    c.drawString(MARGIN + 18, 504, "VOUS AVEZ CAPTÉ UN BEAU MOMENT?")
    y = paragraph(
        c,
        "Déposez ici vos images de l’événement pour les transmettre directement à Bleu Massawippi. Les autres personnes ne peuvent ni voir, ni modifier, ni supprimer les fichiers déposés.",
        MARGIN + 18,
        481,
        PAGE_W - 2 * MARGIN - 36,
        size=10,
        leading=13,
    )
    c.setStrokeColor(TEAL)
    c.line(MARGIN + 18, y - 3, PAGE_W - MARGIN - 18, y - 3)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 10.8)
    c.drawString(MARGIN + 18, y - 22, "CAPTURED A MOMENT YOU’D LIKE TO SHARE?")
    paragraph(
        c,
        "Upload it here to send it directly to Bleu Massawippi. Other contributors cannot view, edit or delete uploaded files.",
        MARGIN + 18,
        y - 40,
        PAGE_W - 2 * MARGIN - 36,
        size=9.4,
        leading=12,
    )

    qr_size = 174
    qr_x, qr_y = PAGE_W - MARGIN - qr_size, 128
    draw_qr(c, url, qr_x, qr_y, qr_size)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 15.5)
    c.drawString(MARGIN, 305, "SCANNEZ · AJOUTEZ · C’EST FAIT")
    c.setFont("BM-Regular", 11.5)
    c.drawString(MARGIN, 284, "Scan · upload · done")
    c.setFillColor(PALE_GOLD)
    c.roundRect(MARGIN, 153, 270, 102, 8, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("BM-Bold", 9.4)
    c.drawString(MARGIN + 13, 233, "AVANT DE DÉPOSER / BEFORE UPLOADING")
    paragraph(
        c,
        "Utilisez vos propres images et assurez-vous que les personnes reconnaissables consentent à leur transmission. Le dépôt ne vaut pas autorisation automatique de publication; Bleu Massawippi confirmera les droits si une image est retenue.",
        MARGIN + 13,
        215,
        244,
        size=7.8,
        leading=10.1,
    )
    footer(c)
    c.showPage()
    c.save()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--logo", type=Path, required=True)
    parser.add_argument("--donation-url", required=True)
    parser.add_argument("--upload-url", default="")
    parser.add_argument(
        "--skip-donation",
        action="store_true",
        help="Generate only the upload poster when an upload URL is supplied.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    register_fonts()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if not args.skip_donation:
        make_donation(
            args.output_dir / "Au_bord_du_bleu_affiche_dons_Zeffy_2026-08-30.pdf",
            args.logo,
            args.donation_url,
        )
    if args.upload_url:
        make_upload(
            args.output_dir / "Au_bord_du_bleu_affiche_depot_photos_videos_2026-08-30.pdf",
            args.logo,
            args.upload_url,
        )


if __name__ == "__main__":
    main()

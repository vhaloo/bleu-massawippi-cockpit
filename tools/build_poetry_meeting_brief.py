from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "cockpit" / "project-documents" / "Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10.pdf"
LOGO = ROOT / "cockpit" / "assets" / "brand" / "logo-bleu-massawippi-2024.png"

NAVY = colors.HexColor("#0C4A63")
TEAL = colors.HexColor("#208E8C")
DEEP_TEAL = colors.HexColor("#17675E")
GOLD = colors.HexColor("#D8A53B")
INK = colors.HexColor("#18343D")
GRAY = colors.HexColor("#5B7178")
PALE_BLUE = colors.HexColor("#EDF7FA")
PALE_TEAL = colors.HexColor("#EAF7F4")
PALE_GOLD = colors.HexColor("#FFF7E5")
LINE = colors.HexColor("#C9DFE1")
WHITE = colors.white

BODY = ParagraphStyle(
    "Body",
    fontName="Helvetica",
    fontSize=8.15,
    leading=10.25,
    textColor=INK,
    alignment=TA_LEFT,
)
CARD_TITLE = ParagraphStyle(
    "CardTitle",
    fontName="Helvetica-Bold",
    fontSize=10.4,
    leading=12.4,
    textColor=NAVY,
)
INTRO = ParagraphStyle(
    "Intro",
    fontName="Helvetica",
    fontSize=9,
    leading=12,
    textColor=INK,
)
FOOT = ParagraphStyle(
    "Foot",
    fontName="Helvetica",
    fontSize=7.2,
    leading=9.2,
    textColor=GRAY,
)


def draw_paragraph(pdf: canvas.Canvas, text: str, style: ParagraphStyle, x: float, top: float, width: float) -> float:
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, 2000)
    paragraph.drawOn(pdf, x, top - height)
    return height


def draw_card(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    number: str,
    title: str,
    items: list[str],
    fill: colors.Color,
) -> None:
    pdf.setFillColor(fill)
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(0.8)
    pdf.roundRect(x, y, width, height, 10, fill=1, stroke=1)

    badge_x = x + 13
    badge_y = y + height - 27
    pdf.setFillColor(TEAL)
    pdf.circle(badge_x + 8, badge_y + 8, 8, fill=1, stroke=0)
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(badge_x + 8, badge_y + 5.2, number)

    draw_paragraph(pdf, title, CARD_TITLE, x + 34, y + height - 12, width - 47)

    cursor = y + height - 44
    for item in items:
        pdf.setStrokeColor(DEEP_TEAL)
        pdf.setLineWidth(0.8)
        pdf.circle(x + 17, cursor - 3.3, 2.6, fill=0, stroke=1)
        used = draw_paragraph(pdf, item, BODY, x + 26, cursor + 2, width - 38)
        cursor -= used + 4.6


def build() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(
        str(OUTPUT),
        pagesize=LETTER,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle("Aide-mémoire - Rencontre North Hatley - Au bord du bleu")
    pdf.setAuthor("Valentin Wittwe, directeur des communications, Bleu Massawippi")
    pdf.setSubject("Questions à confirmer avec la direction générale de North Hatley le 10 août 2026")

    page_width, page_height = LETTER
    margin = 0.45 * inch
    content_width = page_width - 2 * margin

    # Header
    pdf.setFillColor(NAVY)
    pdf.rect(0, page_height - 1.42 * inch, page_width, 1.42 * inch, fill=1, stroke=0)
    logo = ImageReader(str(LOGO))
    pdf.setFillColor(WHITE)
    pdf.roundRect(margin, page_height - 1.19 * inch, 0.94 * inch, 0.78 * inch, 10, fill=1, stroke=0)
    pdf.drawImage(logo, margin + 0.06 * inch, page_height - 1.12 * inch, width=0.82 * inch, height=0.64 * inch, mask="auto", preserveAspectRatio=True, anchor="c")
    text_x = margin + 1.04 * inch
    pdf.setFillColor(colors.HexColor("#9EE4E0"))
    pdf.setFont("Helvetica-Bold", 8.2)
    pdf.drawString(text_x, page_height - 0.39 * inch, "AU BORD DU BLEU - RENCONTRE DU 10 AOÛT 2026")
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 20.5)
    pdf.drawString(text_x, page_height - 0.70 * inch, "Aide-mémoire pour North Hatley")
    pdf.setFont("Helvetica", 9.2)
    pdf.setFillColor(colors.HexColor("#DCEFF2"))
    pdf.drawString(text_x, page_height - 0.94 * inch, "Questions à confirmer avec la direction générale municipale")
    pdf.setFillColor(GOLD)
    pdf.roundRect(page_width - margin - 1.38 * inch, page_height - 1.05 * inch, 1.38 * inch, 0.55 * inch, 9, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawCentredString(page_width - margin - 0.69 * inch, page_height - 0.73 * inch, "DIM. 30 AOÛT")
    pdf.setFont("Helvetica-Bold", 7.8)
    pdf.drawCentredString(page_width - margin - 0.69 * inch, page_height - 0.90 * inch, "13 H A 16 H")

    # Purpose callout
    callout_top = page_height - 1.57 * inch
    callout_height = 0.72 * inch
    pdf.setFillColor(PALE_GOLD)
    pdf.setStrokeColor(colors.HexColor("#E7C87F"))
    pdf.roundRect(margin, callout_top - callout_height, content_width, callout_height, 9, fill=1, stroke=1)
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 9.2)
    pdf.drawString(margin + 13, callout_top - 18, "But de la rencontre")
    draw_paragraph(
        pdf,
        "Confirmer le site, les autorisations, les responsabilités et le plan de repli. "
        "Aucune promesse implicite : chaque point doit se terminer par une décision, une personne responsable et une échéance.",
        INTRO,
        margin + 13,
        callout_top - 27,
        content_width - 26,
    )

    # Four decision cards
    gap = 0.15 * inch
    card_width = (content_width - gap) / 2
    card_height = 2.15 * inch
    row1_y = callout_top - callout_height - gap - card_height
    row2_y = row1_y - gap - card_height

    draw_card(
        pdf,
        margin,
        row1_y,
        card_width,
        card_height,
        "1",
        "Lieu et autorité",
        [
            "Quelle zone exacte du parc Lôbadanaki peut accueillir le public, le son léger et les tentes?",
            "Quelle autorisation officielle faut-il obtenir : réservation, permis, résolution ou entente?",
            "Quelles limites protègent la bande riveraine et la voie d'urgence?",
            "Qui sera la personne-contact municipale avant et pendant l'événement?",
        ],
        PALE_TEAL,
    )
    draw_card(
        pdf,
        margin + card_width + gap,
        row1_y,
        card_width,
        card_height,
        "2",
        "Horaire et logistique",
        [
            "Confirmer le 30 août, de 13 h à 16 h; installation dès 12 h et rangement jusqu'à 16 h 30.",
            "Quelle capacité, quels accès, toilettes, stationnements et mesures d'accessibilité faut-il prévoir?",
            "Son, électricité, tentes, tables et chaises : qu'est-ce qui est permis ou disponible?",
            "Quelles exigences d'assurance, de sécurité, de voisinage ou de bruit s'appliquent?",
        ],
        PALE_BLUE,
    )
    draw_card(
        pdf,
        margin,
        row2_y,
        card_width,
        card_height,
        "3",
        "Météo et décision",
        [
            "Existe-t-il un lieu couvert de repli ou faut-il retenir une date de reprise?",
            "Qui prend la décision météo, à quel moment et par quel canal la communique-t-on?",
            "Quelles conditions imposent un déplacement ou une annulation?",
            "Quel message commun doit être prêt pour le public et les artistes?",
        ],
        PALE_BLUE,
    )
    draw_card(
        pdf,
        margin + card_width + gap,
        row2_y,
        card_width,
        card_height,
        "4",
        "Collaboration et visibilité",
        [
            "La municipalité souhaite-t-elle relayer l'appel, l'événement et le bilan?",
            "Quelles règles encadrent son nom, son logo et une courte prise de parole?",
            "Quels documents Bleu Massawippi doit-il fournir, à qui et pour quelle échéance?",
            "Quel appui concret peut être confirmé : lieu, matériel, logistique ou diffusion?",
        ],
        PALE_TEAL,
    )

    # Closing strip
    closing_y = margin + 0.56 * inch
    closing_h = 0.76 * inch
    pdf.setFillColor(NAVY)
    pdf.roundRect(margin, closing_y, content_width, closing_h, 10, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor("#9EE4E0"))
    pdf.setFont("Helvetica-Bold", 8.4)
    pdf.drawString(margin + 13, closing_y + closing_h - 18, "AVANT DE QUITTER LA RENCONTRE")
    draw_paragraph(
        pdf,
        '<font color="#FFFFFF"><b>Noter pour chaque point :</b> décision confirmée - responsable - échéance - document requis - plan B. '
        "Si un élément reste incertain, convenir du prochain geste et de la personne qui fera le suivi.</font>",
        INTRO,
        margin + 13,
        closing_y + closing_h - 25,
        content_width - 26,
    )

    # Footer
    pdf.setStrokeColor(LINE)
    pdf.line(margin, margin + 0.35 * inch, page_width - margin, margin + 0.35 * inch)
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(GRAY)
    pdf.drawString(margin, margin + 0.17 * inch, "Document de travail - Bleu Massawippi - 28 juillet 2026")
    pdf.drawRightString(page_width - margin, margin + 0.17 * inch, "Préparation et prise de notes : environ 35 min")

    pdf.showPage()
    pdf.save()
    return OUTPUT


if __name__ == "__main__":
    result = build()
    print(f"{result}\t{result.stat().st_size}")

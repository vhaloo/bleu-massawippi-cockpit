from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "cockpit" / "project-documents"
OUTPUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#163A5F")
TEAL = colors.HexColor("#258A84")
DEEP_TEAL = colors.HexColor("#17675E")
PALE_TEAL = colors.HexColor("#EAF7F4")
PALE_BLUE = colors.HexColor("#EFF6FA")
PALE_GOLD = colors.HexColor("#FFF7E5")
PALE_RED = colors.HexColor("#FFF0EE")
INK = colors.HexColor("#1D2B34")
GRAY = colors.HexColor("#5F6F78")
MID_GRAY = colors.HexColor("#D7E0E5")
WHITE = colors.white


BASE = getSampleStyleSheet()
STYLES = {
    "title": ParagraphStyle(
        "Title",
        parent=BASE["Title"],
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=29,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=11,
    ),
    "subtitle": ParagraphStyle(
        "Subtitle",
        parent=BASE["BodyText"],
        fontName="Helvetica",
        fontSize=11.5,
        leading=16,
        textColor=GRAY,
        spaceAfter=14,
    ),
    "h1": ParagraphStyle(
        "H1",
        parent=BASE["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=NAVY,
        spaceBefore=10,
        spaceAfter=8,
    ),
    "h2": ParagraphStyle(
        "H2",
        parent=BASE["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=14,
        textColor=DEEP_TEAL,
        spaceBefore=5,
        spaceAfter=4,
    ),
    "body": ParagraphStyle(
        "Body",
        parent=BASE["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13.2,
        textColor=INK,
        spaceAfter=6,
    ),
    "small": ParagraphStyle(
        "Small",
        parent=BASE["BodyText"],
        fontName="Helvetica",
        fontSize=7.7,
        leading=10.5,
        textColor=GRAY,
    ),
    "bullet": ParagraphStyle(
        "Bullet",
        parent=BASE["BodyText"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.5,
        textColor=INK,
        leftIndent=12,
        firstLineIndent=-7,
        bulletIndent=0,
        spaceAfter=3,
    ),
    "callout": ParagraphStyle(
        "Callout",
        parent=BASE["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=DEEP_TEAL,
        spaceAfter=0,
    ),
    "table_head": ParagraphStyle(
        "TableHead",
        parent=BASE["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=7.7,
        leading=9.5,
        textColor=WHITE,
    ),
    "table": ParagraphStyle(
        "Table",
        parent=BASE["BodyText"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=INK,
    ),
    "cover_meta": ParagraphStyle(
        "CoverMeta",
        parent=BASE["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=DEEP_TEAL,
        alignment=TA_CENTER,
    ),
}


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, STYLES[style])


def bullet(items: list[str]) -> list[Paragraph]:
    return [Paragraph(f"• {item}", STYLES["bullet"]) for item in items]


def callout(text: str, background=PALE_TEAL, border=TEAL) -> Table:
    block = Table([[p(text, "callout")]], colWidths=[6.65 * inch])
    block.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LINEBEFORE", (0, 0), (0, -1), 5, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return block


def matrix(headers: list[str], rows: list[list[str]], widths: list[float]) -> Table:
    data = [[p(cell, "table_head") for cell in headers]]
    data.extend([[p(cell, "table") for cell in row] for row in rows])
    table = Table(data, colWidths=[width * inch for width in widths], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.45, MID_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
            ]
        )
    )
    return table


def source(label: str, url: str, note: str) -> Paragraph:
    return p(f'<b><link href="{url}" color="#17675E">{label}</link></b> — {note}', "small")


def page_decorator(title: str):
    def draw(canvas, document):
        canvas.saveState()
        width, height = LETTER
        canvas.setStrokeColor(MID_GRAY)
        canvas.setLineWidth(0.5)
        canvas.line(0.72 * inch, height - 0.54 * inch, width - 0.72 * inch, height - 0.54 * inch)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(NAVY)
        canvas.drawString(0.72 * inch, height - 0.40 * inch, "BLEU MASSAWIPPI · PROPOSITION INTERNE ASSAINIE")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GRAY)
        canvas.drawRightString(width - 0.72 * inch, height - 0.40 * inch, title[:60])
        canvas.line(0.72 * inch, 0.52 * inch, width - 0.72 * inch, 0.52 * inch)
        canvas.drawString(0.72 * inch, 0.35 * inch, "Rédaction : Valentin Wittwe, directeur des communications, Bleu Massawippi")
        canvas.drawRightString(width - 0.72 * inch, 0.35 * inch, f"Page {document.page}")
        canvas.restoreState()

    return draw


def cover(story: list, title: str, subtitle: str, status: str, recommendation: str):
    story.extend(
        [
            Spacer(1, 0.42 * inch),
            p("DOSSIER DE PROPOSITION", "cover_meta"),
            Spacer(1, 0.14 * inch),
            p(title, "title"),
            p(subtitle, "subtitle"),
            callout(recommendation),
            Spacer(1, 0.18 * inch),
            matrix(
                ["État", "Portée", "Date de travail"],
                [[status, "Étude et cadrage seulement — aucun engagement", "16 juillet 2026"]],
                [2.2, 2.75, 1.7],
            ),
            Spacer(1, 0.25 * inch),
            p("Mode d’emploi", "h1"),
            p(
                "Ce document prépare une décision. Il distingue les faits publics, les hypothèses, les questions à résoudre, les scénarios possibles et les prochaines actions. Toute promesse externe, dépense, date ou entente demeure conditionnelle aux validations de gouvernance, de capacité, de budget et de conformité.",
                "body",
            ),
        ]
    )


def build_fund() -> Path:
    path = OUTPUT / "Proposition_assainie_fonds-environnemental-partenarial_v1.pdf"
    title = "Fonds environnemental partenarial — modèle de Saint-Ferdinand"
    doc = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title=title,
        author="Valentin Wittwe, directeur des communications, Bleu Massawippi",
        subject="Étude de faisabilité interne et assainie",
    )
    story: list = []
    cover(
        story,
        title,
        "Comprendre « Environnement en actions », vérifier sa gouvernance et évaluer trois voies d’adaptation possibles pour Bleu Massawippi.",
        "À cadrer · recherche prioritaire",
        "Recommandation : organiser une rencontre d’information de 45 minutes avec Saint-Ferdinand avant de concevoir une campagne, un fonds ou une plateforme.",
    )
    story.extend(
        [
            p("1. Résumé décisionnel", "h1"),
            p(
                "Le modèle observé associe une municipalité, un établissement touristique et d’autres entreprises locales. Des activités ou services sont proposés par une plateforme de prévente; une partie des revenus est destinée à un fonds vert principalement lié au lac William. L’idée est compatible avec la mission de Bleu Massawippi parce qu’elle relie financement local, expérience citoyenne, tourisme et protection du lac.",
            ),
            p(
                "La transposition n’est toutefois pas immédiate. Les sources publiques ne décrivent pas la gouvernance de façon parfaitement cohérente : la page municipale parle d’un fonds administré par la Ville, alors qu’un reportage le présente comme indépendant des opérations municipales. La première valeur de la démarche sera donc de comprendre le montage réel — juridique, financier, décisionnel et opérationnel — plutôt que d’en reproduire seulement le message public.",
            ),
            callout(
                "Décision demandée : autoriser une prise de contact exploratoire, sans annoncer de projet ni solliciter de partenaire.",
                PALE_GOLD,
                colors.HexColor("#D4A33E"),
            ),
            PageBreak(),
            p("2. Ce que la recherche publique permet d’établir", "h1"),
        ]
    )
    story.extend(
        bullet(
            [
                "La municipalité présente « Environnement en actions » comme un partenariat initié avec le Manoir du lac William.",
                "Une plateforme de prévente municipale donne accès à des activités, expériences ou services offerts par différents partenaires.",
                "Une partie des revenus alimente un fonds vert consacré à des projets environnementaux, principalement en lien avec le lac William.",
                "La participation d’entreprises locales crée une double proposition de valeur : mobilisation environnementale et visibilité/achalandage local.",
                "Un reportage de lancement évoque environ 25 à 30 % des profits, un objectif proche de 100 000 $, une formule récurrente et des usages possibles comme le myriophylle, les sédiments ou les berges. Ces indications doivent être confirmées par documents avant d’être utilisées comme paramètres.",
                "Un produit partenaire documente aussi un montant fixe de 5 $ versé au fonds par plante vendue, ce qui montre qu’un mécanisme uniforme n’est pas nécessairement requis pour tous les partenaires.",
            ]
        )
    )
    story.extend(
        [
            p("Incertitude structurante", "h2"),
            p(
                "Administration municipale, fonds indépendant, initiative conjointe ou combinaison de ces éléments : cette question change la responsabilité, la reddition, la fiscalité, la sélection des projets et la confiance des partenaires. Elle doit être résolue avant toute recommandation à Bleu Massawippi.",
            ),
            p("3. Trois scénarios d’adaptation", "h1"),
            matrix(
                ["Scénario", "Fonctionnement", "Forces", "Conditions avant d’avancer"],
                [
                    [
                        "A · Fonds affecté à Bleu Massawippi",
                        "Contributions réservées à un programme défini; comptabilité et rapport distincts.",
                        "Pilotage direct, récit clair, lien fort avec la mission.",
                        "Politique d’affectation, gouvernance, capacité comptable, règles de sélection et transparence annuelle.",
                    ],
                    [
                        "B · Fonds municipal",
                        "Une municipalité encaisse, administre et choisit les décaissements; l’OBNL agit comme partenaire ou porteur de projets.",
                        "Cadre public et proximité avec les politiques municipales.",
                        "Mandat clair, processus équitable, admissibilité de l’OBNL, calendrier et mécanisme de reddition.",
                    ],
                    [
                        "C · Initiative conjointe",
                        "Entente entre municipalité, OBNL et partenaires; rôles séparés pour vente, sélection, livraison et rapport.",
                        "Mobilise plusieurs forces et peut devenir un levier régional.",
                        "Entente formelle, responsabilités, données, marques, frais, taxes, conflits d’intérêts et gouvernance commune.",
                    ],
                ],
                [1.25, 1.8, 1.35, 2.25],
            ),
            PageBreak(),
            p("4. Guide d’entretien avec Saint-Ferdinand", "h1"),
            p("Gouvernance et décisions", "h2"),
        ]
    )
    story.extend(
        bullet(
            [
                "Quelle entité possède le fonds, le compte et la plateforme?",
                "Qui autorise un projet, un paiement et une modification des règles?",
                "Existe-t-il un comité de sélection, une politique d’admissibilité et un mécanisme de conflit d’intérêts?",
                "Quels rapports sont publics et quelle vérification financière est appliquée?",
            ]
        )
    )
    story.extend([p("Finances, contrats et opérations", "h2")])
    story.extend(
        bullet(
            [
                "Le pourcentage porte-t-il sur le revenu, le bénéfice ou une contribution fixe? Peut-il varier par partenaire?",
                "Qui absorbe les frais de paiement, taxes, remboursements, annulations, assurances et service à la clientèle?",
                "Quelles ententes protègent les marques, les données clients et les promesses de visibilité?",
                "Combien d’heures de travail la plateforme et le suivi exigent-ils chaque mois?",
                "Comment distinguer achat, commandite et don admissible? Quels reçus sont permis?",
            ]
        )
    )
    story.extend([p("Résultats et apprentissages", "h2")])
    story.extend(
        bullet(
            [
                "Montants bruts et nets recueillis; coûts réels; taux de conversion; partenaires actifs.",
                "Projets financés ou en sélection; critères d’impact; échéancier de décaissement.",
                "Difficultés rencontrées, ajustements déjà faits et recommandations à une autre communauté.",
                "Conditions pour qu’une organisation voisine observe, collabore ou adapte le modèle.",
            ]
        )
    )
    story.extend(
        [
            p("5. Séquence de travail proposée", "h1"),
            matrix(
                ["Étape", "Action", "Responsable principal", "Durée estimée", "Sortie"],
                [
                    ["1", "Demande de rencontre et de documents", "Direction générale", "15–30 min", "Contact confirmé"],
                    ["2", "Préparation de la fiche et du guide d’entretien", "Communications", "2 h", "Dossier de questions"],
                    ["3", "Rencontre d’information", "Direction + communications", "45 min", "Notes factuelles"],
                    ["4", "Comparaison des trois scénarios", "Communications", "2–3 h", "Note de faisabilité"],
                    ["5", "Revue comptable/juridique ciblée si nécessaire", "Direction", "À estimer", "Risques clarifiés"],
                    ["6", "Décision : arrêter, approfondir ou piloter", "Direction / gouvernance", "30 min", "Décision consignée"],
                ],
                [0.35, 2.25, 1.35, 0.8, 1.9],
            ),
            p("Critères de feu vert", "h2"),
        ]
    )
    story.extend(
        bullet(
            [
                "Gouvernance, propriétaire des fonds et règles de décaissement compris par écrit.",
                "Charge opérationnelle compatible avec la capacité réelle de l’organisation.",
                "Coûts et flux nets suffisamment transparents pour les partenaires et le public.",
                "Aucune confusion entre vente, commandite et don; traitement fiscal validé.",
                "Projets admissibles, conflits d’intérêts, données personnelles et reddition encadrés.",
            ]
        )
    )
    story.extend(
        [
            PageBreak(),
            p("6. Risques, garde-fous et décision", "h1"),
            matrix(
                ["Risque", "Niveau", "Garde-fou"],
                [
                    ["Promettre un modèle mal compris", "Élevé", "Aucune annonce avant rencontre et documents."],
                    ["Confusion achat/don/commandite", "Élevé", "Validation comptable et juridique ciblée."],
                    ["Gouvernance ou conflits d’intérêts", "Élevé", "Politique écrite, comité et critères publics."],
                    ["Charge de plateforme sous-estimée", "Moyen", "Chiffrage du temps, frais et service à la clientèle."],
                    ["Partenaires déçus par la visibilité", "Moyen", "Ententes et livrables mesurables."],
                    ["Fonds sans projets prêts", "Moyen", "Pipeline de projets admissibles avant le lancement."],
                ],
                [2.1, 0.75, 3.8],
            ),
            Spacer(1, 0.15 * inch),
            callout(
                "Décision proposée maintenant : OUI à l’étude et à la rencontre; PAS ENCORE au lancement d’un fonds, d’une plateforme ou d’une sollicitation.",
                PALE_GOLD,
                colors.HexColor("#D4A33E"),
            ),
            p("Sources publiques consultées", "h1"),
            source("Municipalité de Saint-Ferdinand — Environnement en actions", "https://www.stferdinand.ca/about-1-2", "présentation officielle du partenariat, de la prévente et du fonds vert."),
            source("Municipalité de Saint-Ferdinand — Lac William", "https://www.stferdinand.ca/lac-william", "composition du comité municipal et exemples d’actions de gestion du lac."),
            source("Courrier Frontenac — lancement du programme", "https://www.courrierfrontenac.qc.ca/actualites/saint-ferdinand-et-le-manoir-du-lac-william-lancent-environnement-en-actions/", "indications de pourcentage, cible, récurrence et usages potentiels à confirmer."),
            source("Jardinerie Fortier — produit partenaire", "https://jardineriefortier.com/collections/vivaces/products/salvia-vivace-mauve-plante-emblematique-2026-du-lac-william", "exemple public d’une contribution fixe de 5 $ par article vendu."),
            Spacer(1, 0.08 * inch),
            p("Les informations publiques décrivent une initiative très récente. La rencontre proposée sert précisément à éviter de transformer des indications de presse en règles de gouvernance non vérifiées.", "small"),
        ]
    )
    doc.build(story, onFirstPage=page_decorator(title), onLaterPages=page_decorator(title))
    return path


def build_interlake() -> Path:
    path = OUTPUT / "Proposition_assainie_colloque-reseautage-associations_v2.pdf"
    title = "Colloques et collaboration interlacs"
    doc = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title=title,
        author="Valentin Wittwe, directeur des communications, Bleu Massawippi",
        subject="Proposition interne de collaboration entre organismes de lacs",
    )
    story: list = []
    cover(
        story,
        title,
        "Une démarche progressive pour partager les pratiques, rapprocher scientifiques, municipalités et organismes, puis produire des outils réellement utiles.",
        "À cadrer · écoute des partenaires",
        "Recommandation : sonder cinq à huit organismes et tester une table ronde de 60 à 90 minutes sur un seul enjeu avant d’organiser une demi-journée ou un colloque.",
    )
    story.extend(
        [
            p("1. Résumé décisionnel", "h1"),
            p(
                "L’idée répond à un besoin réel : les organismes de lacs disposent d’expériences, de données et d’outils complémentaires, mais leurs petites équipes manquent souvent de temps pour les comparer et les adapter. Une rencontre bien cadrée peut accélérer le transfert de pratiques, éviter des erreurs répétées et créer des collaborations concrètes.",
            ),
            p(
                "Plusieurs réseaux remplissent déjà une partie de cette fonction. Le RAPPEL anime des échanges entre associations et un colloque sur l’eau; le ROBVQ organise des Rendez-vous réunissant les acteurs de l’eau; la nouvelle Table québécoise d’expertise sur les lacs vise l’harmonisation des pratiques et l’appui aux associations. Bleu Massawippi doit donc contribuer à cet écosystème, pas le dupliquer.",
            ),
            callout("Positionnement recommandé : hôte régional d’un besoin précis, partenaire des réseaux existants et producteur d’une synthèse réutilisable."),
            PageBreak(),
            p("2. Objectifs et proposition de valeur", "h1"),
        ]
    )
    story.extend(
        bullet(
            [
                "Partager des pratiques qui ont réellement fonctionné, avec leurs conditions, coûts et limites.",
                "Comparer les expériences d’associations, d’OBV, de municipalités, de scientifiques et de partenaires régionaux.",
                "Créer des outils communs : modèles, checklists, repères scientifiques, contacts et messages publics.",
                "Faire émerger deux ou trois collaborations confiées à des responsables et suivies après la rencontre.",
                "Renforcer la crédibilité et les liens de Bleu Massawippi sans imposer une nouvelle structure permanente.",
            ]
        )
    )
    story.extend(
        [
            p("Publics à relier", "h2"),
            matrix(
                ["Groupe", "Contribution possible", "Ce qu’il faut respecter"],
                [
                    ["Associations de lacs", "Cas concrets, bénévolat, mobilisation, outils éprouvés", "Temps limité; réciprocité; consentement au partage"],
                    ["OBV / COGESAF / ROBVQ", "Gestion intégrée, réseau, outils, plans directeurs", "Arrimage territorial; ne pas dupliquer les mandats"],
                    ["RAPPEL et CRE", "Expertise technique, accompagnement, communauté de pratique", "Clarifier le rôle de partenaire ou d’intervenant"],
                    ["Municipalités et MRC", "Règlements, infrastructures, financement, coordination", "Mandats et prises de parole confirmés"],
                    ["Scientifiques", "Méthodes, limites, tendances et besoins de recherche", "Temps, sources, données sensibles et exactitude"],
                    ["Partenaires privés", "Soutien logistique ou financier", "Aucune influence indue sur le contenu scientifique"],
                ],
                [1.45, 2.55, 2.65],
            ),
            p("3. Progression recommandée", "h1"),
            matrix(
                ["Niveau", "Format", "But", "Condition de passage"],
                [
                    ["1 · Écoute", "5 à 8 appels de 20 min", "Repérer le besoin non couvert et les contraintes", "Un thème commun revient clairement"],
                    ["2 · Table ronde", "60 à 90 min en ligne", "Comparer 3 à 5 cas et produire un premier outil", "Participants demandent un approfondissement"],
                    ["3 · Demi-journée", "Présentiel ou hybride", "Ateliers, démonstrations, engagements", "Partenaires et capacité confirmés"],
                    ["4 · Rendez-vous récurrent", "Rythme choisi ensemble", "Maintenir les outils et collaborations", "Responsables et valeur démontrés"],
                ],
                [1.05, 1.7, 2.2, 1.7],
            ),
            PageBreak(),
            p("4. Thèmes et premier pilote", "h1"),
            p("Banque de thèmes", "h2"),
        ]
    )
    story.extend(
        bullet(
            [
                "Espèces exotiques envahissantes : prévention, détection, réponse et messages au public.",
                "Cyanobactéries et qualité de l’eau : observation, signalement, interprétation et communication prudente.",
                "Tributaires, sédiments et bandes riveraines : données, priorités et mobilisation des propriétaires.",
                "Lavage des embarcations et accès au lac : cohérence régionale, comportements et preuve d’efficacité.",
                "Mobilisation citoyenne et bénévolat : recrutement, consentement, sécurité et reconnaissance.",
                "Financement et partenariats : coûts, preuves, reddition, commandites et collaboration municipale.",
                "Données terrain et communication scientifique : standards minimaux, limites et visualisation publique.",
            ]
        )
    )
    story.extend(
        [
            p("Déroulé type — table ronde de 90 minutes", "h2"),
            matrix(
                ["Temps", "Séquence", "Résultat attendu"],
                [
                    ["0–10 min", "Accueil, question centrale et règles de partage", "Cadre commun"],
                    ["10–35 min", "Trois cas de 7 minutes, limites incluses", "Pratiques comparables"],
                    ["35–65 min", "Échange guidé : ce qui fonctionne, ce qui bloque", "Constats et conditions"],
                    ["65–80 min", "Atelier éclair sur un outil commun", "Brouillon réutilisable"],
                    ["80–90 min", "Engagements, responsables, date de synthèse", "Suivis datés"],
                ],
                [0.8, 3.2, 2.65],
            ),
            p("Livrables obligatoires", "h2"),
        ]
    )
    story.extend(
        bullet(
            [
                "Compte rendu de deux pages distinguant consensus, divergences et questions ouvertes.",
                "Matrice de pratiques avec conditions de réussite, coûts approximatifs et sources.",
                "Trois outils ou modèles accessibles aux participants.",
                "Liste de contacts partagée uniquement avec consentement.",
                "Tableau des engagements avec responsable, échéance et prochain point.",
            ]
        )
    )
    story.extend(
        [
            p("5. Plan d’action et partage des responsabilités", "h1"),
            matrix(
                ["Action", "Direction générale", "Communications", "Durée indicative"],
                [
                    ["Choisir le thème et le niveau d’ambition", "Décider", "Préparer la recommandation", "20 min + 1 h"],
                    ["Ouvrir les portes auprès des partenaires", "Contacter les directions", "Préparer les messages", "1,5 h + 1 h"],
                    ["Conduire l’écoute", "Participer aux appels clés", "Planifier, interviewer, synthétiser", "1 h + 4 h"],
                    ["Construire le pilote", "Valider budget et engagements", "Programme, inscription, animation", "40 min + 5 h"],
                    ["Livrer et suivre", "Présence institutionnelle", "Coordination et synthèse", "2 h + 6 h"],
                ],
                [1.75, 1.75, 2.25, 0.9],
            ),
            PageBreak(),
            p("6. Risques, mesure et critères de décision", "h1"),
            matrix(
                ["Risque", "Garde-fou"],
                [
                    ["Dédoublement d’une offre existante", "Consulter RAPPEL, COGESAF et réseaux concernés avant l’annonce."],
                    ["Programme trop large", "Un thème, une question centrale et trois résultats maximum."],
                    ["Faible disponibilité", "Format court, calendrier sondé et documents envoyés à l’avance."],
                    ["Événement sans suite", "Responsables, échéances et outil commun obligatoires avant la clôture."],
                    ["Promesse scientifique imprécise", "Sources, limites et validation des intervenants avant publication."],
                    ["Coordonnées ou propos diffusés sans accord", "Consentement distinct pour répertoire, citation et captation."],
                ],
                [2.25, 4.4],
            ),
            p("Indicateurs utiles", "h2"),
        ]
    )
    story.extend(
        bullet(
            [
                "Taux d’organismes consultés qui confirment le même besoin.",
                "Participation réelle des publics visés, sans viser le volume pour lui-même.",
                "Nombre d’outils livrés et réellement réutilisés dans les 60 jours.",
                "Collaborations lancées, responsables nommés et suivis complétés.",
                "Satisfaction qualitative : ce que les participants pourront faire différemment dès demain.",
            ]
        )
    )
    story.extend(
        [
            callout(
                "Décision proposée maintenant : autoriser l’écoute et un pilote léger; réserver le mot « colloque » à une étape ultérieure si la demande et la capacité sont démontrées.",
                PALE_GOLD,
                colors.HexColor("#D4A33E"),
            ),
            p("Sources et réseaux de référence", "h1"),
            source("RAPPEL", "https://rappel.qc.ca/", "communauté d’échanges entre associations de lacs et colloque sur l’eau."),
            source("ROBVQ — Rendez-vous sur l’eau", "https://robvq.qc.ca/description-des-rendez-vous-sur-leau/", "modèle de rencontre entre milieux municipal, communautaire, scientifique, gouvernemental et économique."),
            source("Table québécoise d’expertise sur les lacs", "https://robvq.qc.ca/tempo/articles/774/lancement-officiel-de-la-table-quebecoise-dexpertise-sur-les-lacs-tqel", "harmonisation des pratiques, outils et organismes relais."),
            source("COGESAF", "https://cogesaf.qc.ca/", "organisme de bassin versant régional à consulter pour l’arrimage territorial."),
            source("CRE Estrie — réseau de membres", "https://creestrie.ca/nos-membres/", "porte d’entrée régionale vers des organismes environnementaux complémentaires."),
        ]
    )
    doc.build(story, onFirstPage=page_decorator(title), onLaterPages=page_decorator(title))
    return path


if __name__ == "__main__":
    for built in (build_fund(), build_interlake()):
        print(f"{built}\t{built.stat().st_size}")

#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pypdf==6.14.2", "reportlab==4.4.9"]
# ///
"""Build the canonical Oceanheart CV variants as ATS-friendly PDFs."""

from __future__ import annotations

from dataclasses import dataclass, field
import html
import re
import shutil
import tempfile
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    Flowable,
    PageBreak,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, DictionaryObject, NameObject, TextStringObject

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "career" / "cv"
FULL_COMPLEMENT_SOURCE_DIR = SOURCE_DIR / "full-complement"
PRIMARY_OUTPUT_DIR = ROOT / "output" / "pdf"
UPLOAD_DIR = PRIMARY_OUTPUT_DIR / "upload"
MIRROR_DIRS = (ROOT / "static" / "cv",)
PORTRAIT = SOURCE_DIR / "assets" / "richard-hallett-about-cv.png"

MONO_REGULAR_PATH = (
    Path.home() / "Library" / "Fonts" / "JetBrainsMonoNerdFont-Regular.ttf"
)
MONO_BOLD_PATH = Path.home() / "Library" / "Fonts" / "JetBrainsMonoNerdFont-Bold.ttf"
if not (MONO_REGULAR_PATH.exists() and MONO_BOLD_PATH.exists()):
    MONO_REGULAR_PATH = Path("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf")
    MONO_BOLD_PATH = Path("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf")
MONO = "Courier"
MONO_BOLD = "Courier-Bold"
if MONO_REGULAR_PATH.exists() and MONO_BOLD_PATH.exists():
    pdfmetrics.registerFont(TTFont("CvMono", MONO_REGULAR_PATH))
    pdfmetrics.registerFont(TTFont("CvMonoBold", MONO_BOLD_PATH))
    MONO = "CvMono"
    MONO_BOLD = "CvMonoBold"

VARIANTS = {
    "forward-deployed-engineer": {
        "source": SOURCE_DIR / "forward-deployed-engineer.md",
        "label": "Forward Deployed Engineer",
        "page_break_before": "Experience",
        "descriptor": "Product engineering | applied AI | client delivery",
        "upload_name": "Richard Hallett",
        "selection_note": (
            "Primary lane. Forward deployed, solutions, and product "
            "engineering roles."
        ),
        "public_mirror": True,
    },
    "applied-ai-engineer": {
        "source": SOURCE_DIR / "applied-ai-engineer.md",
        "label": "Applied AI Engineer",
        "page_break_before": "Experience",
        "descriptor": "Production LLM systems | evaluation | safety",
        "upload_name": "Richard James Hallett",
        "selection_note": (
            "Primary lane. Applied AI and production LLM roles, regulated "
            "and safety angle."
        ),
        "public_mirror": True,
    },
    "frontend-developer": {
        "source": FULL_COMPLEMENT_SOURCE_DIR / "frontend-developer.md",
        "label": "Frontend Developer",
        "descriptor": "React | TypeScript | product interfaces",
        "upload_name": "Rick Hallett",
        "selection_note": "Full complement. Frontend, React, and UI roles.",
        "public_mirror": False,
    },
    "full-stack-developer": {
        "source": FULL_COMPLEMENT_SOURCE_DIR / "full-stack-developer.md",
        "label": "Full Stack Developer",
        "descriptor": "TypeScript | React | Node.js | delivery",
        "upload_name": "Richard J Hallett",
        "selection_note": (
            "Full complement. General full stack (TypeScript, React, Node) "
            "roles."
        ),
        "public_mirror": False,
    },
    "workflow-automation-engineer": {
        "source": FULL_COMPLEMENT_SOURCE_DIR / "workflow-automation-engineer.md",
        "label": "Workflow Automation Engineer",
        "descriptor": "APIs | agents | operational workflows",
        "upload_name": "Rick J Hallett",
        "selection_note": (
            "Full complement. Automation, integration, and agent ops roles."
        ),
        "public_mirror": False,
    },
    "technical-operations-engineer": {
        "source": FULL_COMPLEMENT_SOURCE_DIR / "technical-operations-engineer.md",
        "label": "Technical Operations Engineer",
        "descriptor": "Support | systems | automation | handoff",
        "upload_name": "R J Hallett",
        "selection_note": "Full complement. Support and technical operations roles.",
        "public_mirror": False,
    },
}

# Canonical CV styling approved 2026-09-07, from the website light pages.
ACCENT = colors.HexColor("#637c83")
INK = colors.HexColor("#151817")
MUTED = colors.HexColor("#4f514d")
RULE = colors.HexColor("#c5c2b9")
PAPER = colors.HexColor("#eee9df")
MONO = MONO_BOLD = "Helvetica"
SITE_STYLE = True

LINK_DESCRIPTIONS = {
    "mailto:kai@oceanheart.ai": "Email Richard Hallett",
    "https://github.com/rickhallett": "Richard Hallett on GitHub",
    "https://www.linkedin.com/in/richardhallett86/": (
        "Richard Hallett on LinkedIn"
    ),
    "https://oceanheart.ai": "Oceanheart website",
    "https://www.sarahmozer.org": "Sarah Mozer Studio",
    "https://becoming-diamond.vercel.app/": "Becoming Diamond",
    "https://mal-demo.up.railway.app/": (
        "LoanSlam production demonstration"
    ),
    "https://www.oceanheart.ai/projects/fail-closed-llm-engine/": (
        "LoanSlam project page"
    ),
    "https://github.com/rickhallett/sortie": "Sortie source repository",
    "https://thepit.cloud": "The Pit",
}


@dataclass
class CvSection:
    heading: str
    blocks: list[tuple[str, str | list[str]]] = field(default_factory=list)


@dataclass
class CvContent:
    title: str
    intro: list[str]
    sections: list[CvSection]


def inline_markup(value: str) -> str:
    """Convert the small Markdown subset used by the CVs to ReportLab markup."""

    escaped = html.escape(value, quote=False)
    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2" color="#637c83"><u>\1</u></a>',
        escaped,
    )
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(
        r"`(.+?)`",
        lambda match: f'<font name="{MONO}">{match.group(1)}</font>',
        escaped,
    )
    return escaped


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "CvName",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=27,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "role": ParagraphStyle(
            "CvRole",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            textColor=ACCENT,
            spaceAfter=2,
        ),
        "descriptor": ParagraphStyle(
            "CvDescriptor",
            parent=base["Normal"],
            fontName=MONO,
            fontSize=7.3,
            leading=9,
            textColor=MUTED,
            spaceAfter=5,
        ),
        "contact": ParagraphStyle(
            "CvContact",
            parent=base["Normal"],
            fontName=MONO,
            fontSize=6.9,
            leading=8.5,
            textColor=MUTED,
        ),
        "fact_label": ParagraphStyle(
            "CvFactLabel",
            parent=base["Normal"],
            fontName=MONO_BOLD,
            fontSize=6.2,
            leading=7.5,
            textColor=ACCENT,
            spaceAfter=2,
        ),
        "fact_value": ParagraphStyle(
            "CvFactValue",
            parent=base["Normal"],
            fontName=MONO,
            fontSize=7.25,
            leading=8.8,
            textColor=INK,
        ),
        "intro": ParagraphStyle(
            "CvIntro",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.15,
            leading=11.8,
            textColor=INK,
            spaceAfter=5.8,
            allowWidows=0,
            allowOrphans=0,
        ),
        "section": ParagraphStyle(
            "CvSection",
            parent=base["Heading2"],
            fontName=MONO_BOLD,
            fontSize=8.35,
            leading=9.8,
            textColor=INK,
            spaceAfter=0,
            keepWithNext=True,
        ),
        "entry": ParagraphStyle(
            "CvEntry",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.15,
            leading=11.8,
            textColor=INK,
            spaceAfter=5.8,
            allowWidows=0,
            allowOrphans=0,
        ),
        "body": ParagraphStyle(
            "CvBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.15,
            leading=11.8,
            textColor=INK,
            spaceAfter=5.8,
            allowWidows=0,
            allowOrphans=0,
        ),
        "bullet": ParagraphStyle(
            "CvBullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.15,
            leading=11.8,
            textColor=INK,
            leftIndent=0,
            firstLineIndent=0,
            spaceAfter=1.5,
        ),
        "mini": ParagraphStyle(
            "CvMini",
            parent=base["Normal"],
            fontName=MONO_BOLD,
            fontSize=6.8,
            leading=8,
            textColor=ACCENT,
            spaceAfter=4,
        ),
        "footer": ParagraphStyle(
            "CvFooter",
            parent=base["Normal"],
            fontName=MONO,
            fontSize=6.3,
            textColor=MUTED,
            alignment=TA_LEFT,
        ),
    }


def parse_markdown(source: Path) -> CvContent:
    lines = source.read_text(encoding="utf-8").splitlines()
    title = "Richard (Kai) Hallett"
    intro: list[str] = []
    sections: list[CvSection] = []
    current: CvSection | None = None
    in_content = False
    index = 0

    while index < len(lines):
        raw = lines[index].strip()
        index += 1

        if not raw:
            continue
        if raw == "---":
            in_content = True
            continue
        if raw.startswith("# "):
            title = raw[2:]
            continue
        if raw.startswith("## "):
            in_content = True
            current = CvSection(raw[3:])
            sections.append(current)
            continue
        if raw.startswith("- "):
            bullet_lines = [raw[2:]]
            while index < len(lines) and lines[index].strip().startswith("- "):
                bullet_lines.append(lines[index].strip()[2:])
                index += 1
            if current is not None:
                current.blocks.append(("bullets", bullet_lines))
            continue
        if not in_content:
            continue
        if current is None:
            intro.append(raw)
        else:
            current.blocks.append(("paragraph", raw))

    return CvContent(title=title, intro=intro, sections=sections)


def contact_paragraph(styles: dict[str, ParagraphStyle]) -> Paragraph:
    link_colour = ACCENT.hexval().replace("0x", "#")
    value = (
        '<a href="mailto:kai@oceanheart.ai" color="#2D5B8E">'
        "<u>kai@oceanheart.ai</u></a>"
        "  |  "
        '<a href="https://github.com/rickhallett" color="#2D5B8E">'
        "<u>github.com/rickhallett</u></a>"
        "  |  "
        '<a href="https://www.linkedin.com/in/richardhallett86/" color="#2D5B8E">'
        "<u>linkedin.com/in/richardhallett86</u></a>"
        "  |  "
        '<a href="https://oceanheart.ai" color="#2D5B8E">'
        "<u>oceanheart.ai</u></a>"
    )
    return Paragraph(value.replace("#2D5B8E", link_colour), styles["contact"])


class SoftPortrait(Flowable):
    """Round and feather the PDF image frame without altering the photo."""

    def __init__(self, path: Path, width: float, height: float):
        super().__init__()
        self.path, self.width, self.height = path, width, height

    def draw(self):
        canvas = self.canv
        canvas.saveState()
        radius = 3 * mm
        clip = canvas.beginPath()
        clip.roundRect(0, 0, self.width, self.height, radius)
        canvas.clipPath(clip, stroke=0, fill=0)
        if SITE_STYLE:
            canvas.setBlendMode("Multiply")
        canvas.drawImage(str(self.path), 0, 0, self.width, self.height,
                         preserveAspectRatio=True, anchor="c", mask="auto")
        canvas.setBlendMode("Normal")
        canvas.setStrokeColor(PAPER)
        # Overlapping translucent contours feather the image into the white page.
        steps = 24
        feather = 1.2 * mm
        for index in range(steps):
            inset = feather * index / steps
            canvas.setStrokeAlpha((1 - index / steps) ** 1.5)
            canvas.setLineWidth(2 * feather / steps)
            canvas.roundRect(inset, inset, self.width - 2 * inset,
                             self.height - 2 * inset, max(radius - inset, 0),
                             stroke=1, fill=0)
        canvas.restoreState()


def header_story(
    content: CvContent,
    label: str,
    descriptor: str,
    styles: dict[str, ParagraphStyle],
    width: float,
    portrait: Path = PORTRAIT,
    compact: bool = False,
) -> list:
    if not portrait.exists():
        raise FileNotFoundError(f"Missing portrait: {portrait}")

    photo_w = (29.5 if compact else 33.9) * mm
    photo_h = (39.333333 if compact else 45.2) * mm
    photo = (
        SoftPortrait(portrait, photo_w, photo_h) if compact else
        Image(str(portrait), width=photo_w, height=photo_h, kind="proportional")
    )
    photo_box = Table([[photo]], colWidths=[photo_w], rowHeights=[photo_h])
    photo_box.setStyle(
        TableStyle(
            [
                *(([("BOX", (0, 0), (-1, -1), 0.65, RULE)]) if not compact else []),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    photo_col = photo_w + 2 * mm
    text_col = width - photo_col - 4 * mm
    inner = text_col - 4 * mm  # left-cell content width (header adds a 4mm gutter)

    def stacked_group(flowables: list) -> Table:
        """Box a set of flowables with zero padding so the group's measured
        height equals its rendered height. That lets us distribute the gaps
        between groups exactly."""
        box = Table([[list(flowables)]], colWidths=[inner])
        box.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return box

    # Tight clones drop trailing paragraph space so every inter-group gap is
    # governed solely by the computed flex gap below.
    name_style = ParagraphStyle("CvNameGrouped", parent=styles["name"], spaceAfter=0)
    descriptor_style = ParagraphStyle(
        "CvDescriptorGrouped", parent=styles["descriptor"], spaceAfter=0
    )

    facts = (
        ("BASED / TRAVEL", "United Kingdom<br/>Remote, hybrid, willing to relocate"),
        ("ENGINEERING", "More than six years<br/>Product and client delivery"),
        ("APPROACH", "Discover, build, verify<br/>Clear communication"),
    )
    fact_cells = [
        [
            Paragraph(fact_label, styles["fact_label"]),
            Paragraph(fact_value, styles["fact_value"]),
        ]
        for fact_label, fact_value in facts
    ]
    # Borderless grid: whitespace gutters only, no ruled columns.
    facts_table = Table([fact_cells], colWidths=[inner / 3] * 3, hAlign="LEFT")
    facts_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (1, 0), (-1, 0), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    # Four vertically stacked groups: name, role+descriptor, links, grid.
    groups = [
        stacked_group([Paragraph(inline_markup(content.title), name_style)]),
        stacked_group(
            [
                Paragraph(html.escape(label), styles["role"]),
                Paragraph(html.escape(descriptor), descriptor_style),
            ]
        ),
        stacked_group([contact_paragraph(styles)]),
        facts_table,
    ]

    # Distribute the leftover vertical space into equal gaps so the stack's
    # height equals the photo and the grid's base sits on the photo's edge.
    heights = [group.wrap(inner, photo_h)[1] for group in groups]
    gap = max((photo_h - sum(heights)) / (len(groups) - 1), 2 * mm)
    identity_stack: list = []
    for index, group in enumerate(groups):
        if index:
            identity_stack.append(Spacer(1, gap))
        identity_stack.append(group)

    header = Table(
        [[identity_stack, photo_box]],
        colWidths=[text_col, photo_col],
        hAlign="LEFT",
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 4 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    return [header, Spacer(1, 3 * mm)]


def section_heading(
    heading: str, styles: dict[str, ParagraphStyle], width: float
) -> Table:
    if SITE_STYLE:
        heading_table = Table([[Paragraph(html.escape(heading.upper()), styles["section"])]],
                              colWidths=[width], hAlign="LEFT")
        heading_table.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        heading_table.keepWithNext = True
        return heading_table
    marker = Table([[""]], colWidths=[4 * mm], rowHeights=[1.4 * mm])
    marker.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    table = Table(
        [[marker, Paragraph(html.escape(heading.upper()), styles["section"])]],
        colWidths=[5.5 * mm, width - 5.5 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    table.keepWithNext = True
    return table


def block_flowables(
    blocks: list[tuple[str, str | list[str]]],
    styles: dict[str, ParagraphStyle],
) -> list:
    flowables: list = []
    for kind, value in blocks:
        if kind == "paragraph" and isinstance(value, str):
            style = styles["entry"] if value.startswith("**") else styles["body"]
            flowables.append(Paragraph(inline_markup(value), style))
        elif kind == "bullets" and isinstance(value, list):
            items = [
                ListItem(Paragraph(inline_markup(item), styles["bullet"]))
                for item in value
            ]
            flowables.append(
                ListFlowable(
                    items,
                    bulletType="bullet",
                    bulletFontName="Helvetica",
                    bulletFontSize=5.5,
                    leftIndent=3.5 * mm,
                    bulletOffsetY=1,
                    spaceAfter=2.5,
                )
            )
    return flowables


def compact_sections(
    education: CvSection,
    technical: CvSection,
    styles: dict[str, ParagraphStyle],
    width: float,
) -> list:
    education_cell = [
        Paragraph("EDUCATION", styles["mini"]),
        *block_flowables(education.blocks, styles),
    ]
    technical_cell = [
        Paragraph("TECHNICAL", styles["mini"]),
        *block_flowables(technical.blocks, styles),
    ]
    columns = Table(
        [[education_cell, technical_cell]],
        colWidths=[width * 0.36, width * 0.64],
        hAlign="LEFT",
    )
    columns.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 5 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 5 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("LINEBEFORE", (1, 0), (1, 0), 0.45, RULE),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [KeepTogether([
        Spacer(1, 2.5 * mm),
        section_heading("Education and technical", styles, width),
        Spacer(1, 3 * mm),
        columns,
    ])]


def markdown_story(
    source: Path,
    label: str,
    descriptor: str,
    styles: dict[str, ParagraphStyle],
    width: float,
    portrait: Path = PORTRAIT,
    compact: bool = False,
    page_break_before: str | None = None,
) -> list:
    content = parse_markdown(source)
    if SITE_STYLE:
        content.title = "Richard Hallett"
    story: list = header_story(content, label, descriptor, styles, width, portrait, compact)

    for paragraph in content.intro:
        story.append(Paragraph(inline_markup(paragraph), styles["intro"]))

    section_map = {section.heading: section for section in content.sections}
    skip: set[str] = set()
    for section in content.sections:
        if section.heading == page_break_before:
            story.append(PageBreak())
        if section.heading in skip:
            continue
        if section.heading == "Education" and "Technical" in section_map:
            story.extend(
                compact_sections(
                    section,
                    section_map["Technical"],
                    styles,
                    width,
                )
            )
            skip.add("Technical")
            continue

        story.extend(
            [
                Spacer(1, (1.0 if compact else 2.5) * mm),
                section_heading(section.heading, styles, width),
                Spacer(1, (1.1 if compact else 2.6) * mm),
            ]
        )
        story.extend(block_flowables(section.blocks, styles))

    return story


def draw_page(canvas, doc, label: str, styles: dict[str, ParagraphStyle]) -> None:
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    if not SITE_STYLE:
        canvas.setFillColor(ACCENT)
        canvas.rect(0, A4[1] - 3.2 * mm, A4[0], 3.2 * mm, stroke=0, fill=1)
    canvas.setFillColor(MUTED)
    canvas.setFont(MONO, 6.2)
    canvas.drawString(doc.leftMargin, 7 * mm, "RICHARD HALLETT" if SITE_STYLE else "RICHARD (KAI) HALLETT")
    canvas.drawRightString(
        A4[0] - doc.rightMargin,
        7 * mm,
        f"{label.upper()} | PAGE {doc.page}",
    )
    canvas.restoreState()


def add_accessible_pdf_metadata(path: Path) -> None:
    """Add document language and descriptions to every link annotation."""

    reader = PdfReader(path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.root_object[NameObject("/Lang")] = TextStringObject("en-GB")
    writer.root_object[NameObject("/ViewerPreferences")] = DictionaryObject(
        {NameObject("/DisplayDocTitle"): BooleanObject(True)}
    )

    for page in writer.pages:
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            if annotation.get("/Subtype") != "/Link":
                continue
            action = annotation.get("/A")
            uri = str(action.get("/URI")) if action and action.get("/URI") else ""
            description = LINK_DESCRIPTIONS.get(uri, f"Open {uri}")
            annotation[NameObject("/Contents")] = TextStringObject(description)

    with tempfile.NamedTemporaryFile(
        prefix=f"{path.stem}-accessible-",
        suffix=".pdf",
        dir=path.parent,
        delete=False,
    ) as handle:
        temporary = Path(handle.name)

    try:
        with temporary.open("wb") as stream:
            writer.write(stream)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def build_variant(slug: str, config: dict[str, object]) -> Path:
    source = config["source"]
    label = str(config["label"])
    descriptor = str(config["descriptor"])
    upload_name = config.get("upload_name")
    public_mirror = bool(config.get("public_mirror", False))
    if not isinstance(source, Path) or not source.exists():
        raise FileNotFoundError(f"Missing canonical CV source: {source}")

    PRIMARY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"richard-hallett-{slug}.pdf"
    destination = PRIMARY_OUTPUT_DIR / filename
    styles = make_styles()
    if SITE_STYLE:
        styles["name"].fontName = "Helvetica"
        styles["name"].fontSize = 27
        styles["name"].leading = 29
        styles["role"].fontName = "Helvetica"
        styles["role"].textColor = MUTED
        styles["section"].textColor = ACCENT
        styles["section"].fontSize = 8.4
    for key in ("intro", "entry", "body", "bullet"):
        styles[key].alignment = TA_JUSTIFY
    compact = bool(config.get("compact", True))
    portrait = Path(config.get("portrait", PORTRAIT))
    if compact:
        for key in ("intro", "entry", "body", "bullet"):
            styles[key].fontSize = 8.7
            styles[key].leading = 10.4
            styles[key].spaceAfter = 4.2 if key != "bullet" else 1.3

    if "body_font_size" in config:
        for key in ("intro", "entry", "body", "bullet"):
            styles[key].fontSize = float(config["body_font_size"])
            styles[key].leading = float(config["body_font_size"]) * 1.18
            styles[key].spaceAfter = 2.5

    with tempfile.NamedTemporaryFile(
        prefix=f"{slug}-", suffix=".pdf", dir=PRIMARY_OUTPUT_DIR, delete=False
    ) as handle:
        temporary = Path(handle.name)

    try:
        document = SimpleDocTemplate(
            str(temporary),
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=10 * mm,
            bottomMargin=12 * mm,
            title=f"Richard Hallett - {label}",
            author="Richard Hallett",
            subject="Curriculum vitae",
        )
        story = markdown_story(source, label, descriptor, styles, document.width, portrait, compact, config.get("page_break_before"))
        document.build(
            story,
            onFirstPage=lambda canvas, doc: draw_page(canvas, doc, label, styles),
            onLaterPages=lambda canvas, doc: draw_page(canvas, doc, label, styles),
        )
        temporary.replace(destination)
        add_accessible_pdf_metadata(destination)
    finally:
        temporary.unlink(missing_ok=True)

    if public_mirror:
        for directory in MIRROR_DIRS:
            directory.mkdir(parents=True, exist_ok=True)
            shutil.copy2(destination, directory / filename)

    if upload_name:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, UPLOAD_DIR / f"{upload_name}.pdf")

    return destination

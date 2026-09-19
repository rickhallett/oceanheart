#!/usr/bin/env python3
"""Build the local hospitality CV without updating the website's CV files."""
import importlib.util
import sys
from pathlib import Path

from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Embed fonts so printing does not depend on a viewer's substitute fonts.
for family in ("Helvetica", "Courier"):
    pdfmetrics.registerFont(TTFont(family, "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"))
    pdfmetrics.registerFont(TTFont(family + "-Bold", "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"))
    pdfmetrics.registerFontFamily(family, normal=family, bold=family + "-Bold", italic=family, boldItalic=family + "-Bold")
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("oceanheart_cv", Path(__file__).with_name("build-cv.py"))
cv = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = cv
spec.loader.exec_module(cv)

def contact(styles):
    return Paragraph('<a href="mailto:kai@oceanheart.ai" color="#2D5B8E"><u>kai@oceanheart.ai</u></a>', styles["contact"])

cv.contact_paragraph = contact

def draw_page(canvas, doc, label, styles):
    canvas.saveState()
    canvas.setFillColor(cv.ACCENT)
    canvas.rect(0, cv.A4[1] - 3.2 * cv.mm, cv.A4[0], 3.2 * cv.mm, stroke=0, fill=1)
    canvas.setFillColor(cv.MUTED)
    canvas.setFont(cv.MONO, 6.2)
    canvas.drawString(doc.leftMargin, 7 * cv.mm, "RICHARD HALLETT")
    canvas.drawRightString(cv.A4[0] - doc.rightMargin, 7 * cv.mm, f"PAGE {doc.page}")
    canvas.restoreState()

cv.draw_page = draw_page
if __name__ == "__main__":
    path = cv.build_variant("hospitality-customer-service", {
        "source": cv.SOURCE_DIR / "hospitality-customer-service.md",
        "label": "",
        "descriptor": "",
        "public_mirror": False,
        "facts": (
            ("SEEKING WORK", "Bournemouth"),
            ("STRENGTHS", "Listening and communication"),
            ("APPROACH", "Considerate and practical"),
        ),
    })
    reader = cv.PdfReader(path)
    writer = cv.PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.add_metadata({"/Title": "Richard Hallett", "/Subject": ""})
    destination = cv.PRIMARY_OUTPUT_DIR / "generic" / "Richard Hallett CV.pdf"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        writer.write(stream)
    path.write_bytes(destination.read_bytes())
    print(destination)

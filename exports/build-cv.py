#!/usr/bin/env python
"""Render the styled CV PDF and write it to both exports/ and static/.

The /cv/ download link serves static/richard-hallett-cv.pdf; exports/ keeps the
canonical styled artifact. Writing both here keeps them in sync automatically.

Run via the jobctl uv env (it has playwright + md_to_html):
    cd /Users/mrkai/code/halo/jobctl && uv run python \
        /Users/mrkai/code/sites/oceanheart/exports/build-cv.py
"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "/Users/mrkai/code/halo/jobctl")
from jobctl.cv_render import md_to_html  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

SITE = Path("/Users/mrkai/code/sites/oceanheart")
SRC = SITE / "cv" / "richard-hallett.md"
OUTPUTS = [SITE / "exports" / "richard-hallett-cv.pdf", SITE / "static" / "richard-hallett-cv.pdf"]

ACCENT, ACCENT2 = "#0e7490", "#0891b2"
CSS = f"""
@page {{ size: A4; margin: 1.5cm 1.8cm; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Helvetica Neue','Arial',sans-serif; font-size: 9.6pt; line-height: 1.5; color: #24292f; }}
h1 {{ font-size: 22pt; font-weight: 700; letter-spacing: -0.4px; color: {ACCENT}; margin-bottom: 1px; }}
h1 + p {{ font-size: 8.2pt; color: #57606a; letter-spacing: 0.2px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid {ACCENT}; }}
h2 {{ font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: {ACCENT}; margin-top: 16px; margin-bottom: 7px; }}
h2::after {{ content: ""; display: block; height: 1px; background: #d8dee4; margin-top: 4px; }}
h3 {{ font-size: 9.6pt; font-weight: 700; margin-top: 8px; margin-bottom: 2px; color: #111; }}
p {{ margin-bottom: 7px; }}
ul, ol {{ margin: 4px 0 6px 16px; }}
li {{ margin-bottom: 3px; }}
strong {{ font-weight: 700; color: #111; }}
em {{ font-style: italic; color: #57606a; }}
a {{ color: {ACCENT2}; text-decoration: none; }}
code {{ font-family: 'SFMono-Regular','Consolas',monospace; font-size: 8.4pt; color: {ACCENT}; }}
@media print {{ h2 {{ page-break-after: avoid; }} h3 {{ page-break-after: avoid; }} p {{ page-break-inside: avoid; }} }}
"""


def main() -> None:
    body = md_to_html(SRC.read_text(encoding="utf-8"))
    html_doc = (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        f"<title>Richard Hallett CV</title><style>{CSS}</style></head>"
        f"<body>{body}</body></html>"
    )
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_doc)
        tmp = Path(f.name)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(f"file://{tmp.resolve()}")
            page.wait_for_load_state("networkidle")
            for out in OUTPUTS:
                out.parent.mkdir(parents=True, exist_ok=True)
                page.pdf(
                    path=str(out),
                    format="A4",
                    print_background=True,
                    margin={"top": "1.5cm", "bottom": "1.5cm", "left": "1.8cm", "right": "1.8cm"},
                )
                print(f"wrote {out} ({out.stat().st_size} bytes)")
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

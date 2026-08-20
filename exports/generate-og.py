#!/usr/bin/env python3
"""Generate OpenGraph card images (1200x630) for every page, in the site's own style.

Renders an HTML template per page through headless Chrome and writes
static/og/<slug>.png, where <slug> matches path.Base of the page's URL
(the content filename stem). head.html picks these up, falling back to
static/og/default.png.

Run locally from the repo root and commit the PNGs, same convention as the
CV PDFs. Chrome is not available in the Vercel build.

Usage: python3 exports/generate-og.py
"""

import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "og"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
THEME_CSS = (ROOT / "static" / "css" / "oceanheart.css").read_text(encoding="utf-8")

KICKER = "AI systems safe to trust for serious work"

TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>{theme_css}</style>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: 1200px; height: 630px; overflow: hidden; }}
  body {{
    background: var(--paper);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 176px;
    grid-template-rows: auto 1fr auto;
    gap: 0 48px;
    padding: 64px 72px;
    font-family: var(--font-mono);
    color: var(--ink);
  }}
  .brand {{
    grid-column: 1;
    grid-row: 1;
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 500;
    color: var(--ink);
  }}
  .brand .accent {{ color: var(--accent-lift); }}
  .mark {{
    grid-column: 2;
    grid-row: 1 / 3;
    width: 156px;
    justify-self: end;
    color: var(--accent-lift);
  }}
  .title {{
    grid-column: 1;
    grid-row: 2;
    align-self: center;
    color: var(--ink); font-family: var(--font-serif);
    font-size: {title_size}px; font-weight: 400;
    line-height: 1.08; letter-spacing: 0; max-width: 920px;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }}
  .title .accent {{ color: var(--accent-lift); }}
  .footer {{ grid-column: 1 / -1; grid-row: 3; }}
  .foot {{
    font-family: var(--font-mono); font-size: 18px; color: var(--faint);
    display: flex; justify-content: space-between; align-items: baseline;
  }}
  .rule {{ border-top: 1px solid var(--rule); margin-bottom: 24px; }}
</style></head>
<body>
  <div class="brand">oceanheart<span class="accent">.ai</span></div>
  <svg class="mark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <path fill="currentColor" fill-rule="evenodd" d="M81 12c24-8 48 4 61 24 11 19 16 47 11 73-4 26-15 51-34 66-20 15-46 12-65-3-20-16-32-40-35-67-3-27 3-56 17-76C47 14 64 9 81 12Zm2 37c-14-5-26 4-32 20-6 16-7 36-3 52 4 17 15 28 28 32 14 5 28-2 35-15 9-16 13-36 11-55-2-18-10-31-23-35-5-2-11-2-16 1Z"/>
    <path fill="currentColor" d="M151 143c12-4 24 3 27 15 3 11-3 22-14 26-11 3-22-3-25-13-3-11 2-22 12-28Z"/>
  </svg>
  <div class="title">{title}</div>
  <div class="footer">
    <div class="rule"></div>
    <div class="foot"><span>www.oceanheart.ai</span><span>{kicker}</span></div>
  </div>
</body></html>
"""


def front_matter_title(path: Path) -> Optional[str]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r'^\+\+\+(.*?)^\+\+\+', text, re.S | re.M)
    if not m:
        return None
    front_matter = m.group(1)
    if re.search(r'^draft\s*=\s*true\s*$', front_matter, re.M):
        return None
    if re.search(r'^render\s*=\s*["\']never["\']\s*$', front_matter, re.M):
        return None
    title = re.search(r'^title\s*=\s*"(.*?)"', front_matter, re.M)
    return title.group(1) if title else None


def title_size(title: str) -> int:
    n = len(re.sub(r"<[^>]+>", "", title))
    if n <= 40:
        return 88
    if n <= 70:
        return 72
    if n <= 110:
        return 60
    return 50


def render(slug: str, title: str) -> None:
    html_doc = TEMPLATE.format(
        kicker=KICKER,
        theme_css=THEME_CSS,
        title=title,
        title_size=title_size(title),
    )
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html_doc)
        tmp = f.name
    out = OUT / f"{slug}.png"
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--window-size=1200,630",
        "--virtual-time-budget=8000",  # let the web fonts arrive before capture
        f"--screenshot={out}", f"file://{tmp}",
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
    finally:
        Path(tmp).unlink(missing_ok=True)
    if res.returncode != 0 or not out.exists():
        print(f"FAILED {slug}: {res.stderr[-300:]}", file=sys.stderr)
        sys.exit(1)
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pages: dict[str, str] = {
        "default": 'oceanheart<span class="accent">.ai</span>',
        "home": "I build the AI that has to be trusted in front of real people.",
        "projects": "Work",
        "blog": "Blog",
    }
    for md in sorted((ROOT / "content").glob("*.md")):
        if md.stem == "_index":
            continue
        title = front_matter_title(md)
        if title:
            pages[md.stem] = html.escape(title)
    for section in ("blog", "projects"):
        for md in sorted((ROOT / "content" / section).glob("*.md")):
            if md.stem == "_index":
                continue
            title = front_matter_title(md)
            if title:
                pages[md.stem] = html.escape(title)
    for slug, title in pages.items():
        render(slug, title)


if __name__ == "__main__":
    main()

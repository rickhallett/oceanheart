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

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "og"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

KICKER = "forward-deployed / applied AI engineering"

TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 1200px; height: 630px;
    background: #1a1b26;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 64px 72px;
    font-family: 'Space Grotesk', sans-serif;
  }}
  .brand {{ font-family: 'JetBrains Mono', monospace; font-size: 28px; color: #7dcfff; }}
  .title {{
    color: #c0caf5; font-size: {title_size}px; font-weight: 700;
    line-height: 1.12; letter-spacing: -0.02em; max-width: 1000px;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }}
  .title .accent {{ color: #7aa2f7; }}
  .foot {{
    font-family: 'JetBrains Mono', monospace; font-size: 22px; color: #7a84ad;
    display: flex; justify-content: space-between; align-items: baseline;
  }}
  .rule {{ border-top: 1px solid #292e42; margin-bottom: 28px; }}
</style></head>
<body>
  <div class="brand">o.ai</div>
  <div class="title">{title}</div>
  <div>
    <div class="rule"></div>
    <div class="foot"><span>www.oceanheart.ai</span><span>{kicker}</span></div>
  </div>
</body></html>
"""


def front_matter_title(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    m = re.search(r'^\+\+\+(.*?)^\+\+\+', text, re.S | re.M)
    if not m:
        return None
    t = re.search(r'^title\s*=\s*"(.*?)"', m.group(1), re.M)
    return t.group(1) if t else None


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
    html_doc = TEMPLATE.format(title=title, title_size=title_size(title), kicker=KICKER)
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
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not out.exists():
        print(f"FAILED {slug}: {res.stderr[-300:]}", file=sys.stderr)
        sys.exit(1)
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pages: dict[str, str] = {
        "default": 'oceanheart<span class="accent">.ai</span>',
        "home": 'I turn business problems into <span class="accent">working systems</span>, fast, using AI as leverage.',
        "projects": "Work",
        "blog": "Blog",
    }
    for md in sorted((ROOT / "content").glob("*.md")):
        if md.stem in ("draft-notice", "_index"):
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

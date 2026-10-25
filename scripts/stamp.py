#!/usr/bin/env python3
"""Stamp cache-busters and the public site URL into the Pages artifact.

The committed page keeps the __SITE_URL__ placeholder. This script runs in
the deploy workflow and rewrites only the copy that gets uploaded.

SITE_URL is the public origin without a trailing slash. When it is empty
and GITHUB_REPOSITORY is set, the script uses the GitHub Pages project URL.
"""

import hashlib
import os
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def versioned(text, rel, token):
    pattern = re.compile(re.escape(rel) + r"(?:\?[^\"'\s)]*)?")
    return pattern.sub(rel + "?v=" + token, text)


def site_url():
    explicit = os.environ.get("SITE_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if "/" not in repo:
        return ""
    owner, name = repo.split("/", 1)
    if name.lower() == f"{owner.lower()}.github.io":
        return f"https://{owner}.github.io"
    return f"https://{owner}.github.io/{name}"


def main():
    font = ROOT / "assets/fonts/TildaSans-VF.woff2"
    script = ROOT / "app.js"
    css_path = ROOT / "styles.css"
    image = ROOT / "assets/og.png"
    html_path = ROOT / "index.html"
    for path in (font, script, css_path, image, html_path):
        if not path.is_file():
            sys.exit(f"missing {path}")

    origin = site_url()
    html = html_path.read_text()
    css = css_path.read_text()
    if ("__SITE_URL__" in html or "__SITE_URL__" in css) and not origin:
        sys.exit(
            "SITE_URL is not set and GITHUB_REPOSITORY is unavailable; "
            "refusing to publish __SITE_URL__"
        )

    font_v = digest(font)
    script_v = digest(script)
    image_v = digest(image)
    css = versioned(css, "assets/fonts/TildaSans-VF.woff2", font_v)
    css_v = hashlib.sha256(css.encode()).hexdigest()[:12]
    html = versioned(html, "styles.css", css_v)
    html = versioned(html, "app.js", script_v)
    html = versioned(html, "assets/fonts/TildaSans-VF.woff2", font_v)
    html = versioned(html, "assets/og.png", image_v)
    if origin:
        html = html.replace("__SITE_URL__", origin)
        css = css.replace("__SITE_URL__", origin)
    if "__SITE_URL__" in html or "__SITE_URL__" in css:
        sys.exit("__SITE_URL__ remains after stamping")
    css_path.write_text(css)
    html_path.write_text(html)
    print(f"site {origin or '(unchanged)'}")
    print(f"css {css_v} js {script_v} font {font_v} og {image_v}")


if __name__ == "__main__":
    main()

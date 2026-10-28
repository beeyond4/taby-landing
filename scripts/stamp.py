#!/usr/bin/env python3
"""Stamp cache-busters and the public site URL into the Pages artifact.

The committed page keeps the __SITE_URL__ placeholder. This script runs in
the deploy workflow and rewrites only the copy that gets uploaded.

SITE_URL is the public site URL without a trailing slash. A GitHub
Pages project path is allowed. When it is empty and GITHUB_REPOSITORY is
set, the script uses the GitHub Pages project URL.

GOOGLE_SITE_VERIFICATION and YANDEX_VERIFICATION, when set, become the
search-console meta tags. They are public once published.
"""

import hashlib
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
TOKEN = re.compile(r"^[A-Za-z0-9._-]{6,200}$")
PLACEHOLDERS = ("__SITE_URL__", "__SITE_HOST__", "__LASTMOD__", "<!-- search-verification -->")


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


def site_host(origin):
    parts = urlsplit(origin)
    if parts.scheme not in ("https", "http") or not parts.netloc or parts.query or parts.fragment:
        sys.exit("SITE_URL must be an absolute http(s) URL without a query or fragment")
    return f"{parts.scheme}://{parts.netloc}"


def verification_block():
    lines = []
    specs = (
        ("GOOGLE_SITE_VERIFICATION", "google-site-verification"),
        ("YANDEX_VERIFICATION", "yandex-verification"),
    )
    for env, name in specs:
        value = os.environ.get(env, "").strip()
        if not value:
            continue
        if not TOKEN.match(value):
            sys.exit(f"{env} must be 6–200 letters, digits, dots, underscores or hyphens")
        lines.append(f'    <meta name="{name}" content="{value}">')
    if not lines:
        return ""
    return "\n".join(lines) + "\n"


def main():
    font = ROOT / "assets/fonts/TildaSans-VF.woff2"
    script = ROOT / "app.js"
    css_path = ROOT / "styles.css"
    image = ROOT / "assets/og.png"
    logo_png = ROOT / "assets/logo.png"
    logo_svg = ROOT / "assets/logo.svg"
    html_path = ROOT / "index.html"
    robots_path = ROOT / "robots.txt"
    sitemap_path = ROOT / "sitemap.xml"
    required = (font, script, css_path, image, logo_png, logo_svg, html_path, robots_path, sitemap_path)
    for path in required:
        if not path.is_file():
            sys.exit(f"missing {path}")

    origin = site_url()
    html = html_path.read_text()
    css = css_path.read_text()
    robots = robots_path.read_text()
    sitemap = sitemap_path.read_text()
    bundled = html + css + robots + sitemap
    if any(token in bundled for token in ("__SITE_URL__", "__SITE_HOST__", "__LASTMOD__")) and not origin:
        sys.exit(
            "SITE_URL is not set and GITHUB_REPOSITORY is unavailable; "
            "refusing to publish site placeholders"
        )
    if "<!-- search-verification -->" not in html:
        sys.exit("missing search-verification marker")

    font_v = digest(font)
    script_v = digest(script)
    image_v = digest(image)
    logo_png_v = digest(logo_png)
    logo_svg_v = digest(logo_svg)
    css = versioned(css, "assets/fonts/TildaSans-VF.woff2", font_v)
    css_v = hashlib.sha256(css.encode()).hexdigest()[:12]
    html = versioned(html, "styles.css", css_v)
    html = versioned(html, "app.js", script_v)
    html = versioned(html, "assets/fonts/TildaSans-VF.woff2", font_v)
    html = versioned(html, "assets/og.png", image_v)
    html = versioned(html, "assets/logo.png", logo_png_v)
    html = versioned(html, "assets/logo.svg", logo_svg_v)
    html = html.replace("    <!-- search-verification -->\n", verification_block())
    if origin:
        host = site_host(origin)
        lastmod = datetime.now(timezone.utc).date().isoformat()
        for old, new in (("__SITE_URL__", origin), ("__SITE_HOST__", host), ("__LASTMOD__", lastmod)):
            html = html.replace(old, new)
            css = css.replace(old, new)
            robots = robots.replace(old, new)
            sitemap = sitemap.replace(old, new)
    published = html + css + robots + sitemap
    leftover = [token for token in PLACEHOLDERS if token in published]
    if leftover:
        sys.exit("placeholders remain after stamping: " + ", ".join(leftover))
    css_path.write_text(css)
    html_path.write_text(html)
    robots_path.write_text(robots)
    sitemap_path.write_text(sitemap)
    print(f"site {origin or '(unchanged)'}")
    print(f"css {css_v} js {script_v} font {font_v} og {image_v} logo {logo_png_v}")


if __name__ == "__main__":
    main()

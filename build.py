#!/usr/bin/env python3
"""Eschede term-paper page: one self-contained deck, one minimal index.
Nothing stored on the device, no external request, content hash on the link."""
import hashlib, pathlib, datetime
H = pathlib.Path(__file__).parent
v = hashlib.sha256((H/"slides.html").read_bytes()).hexdigest()[:12]
built = datetime.datetime.now().strftime("%d %b %Y, %H:%M")
CSS = """:root{--ink:#15171c;--mut:#737b88;--line:#dfe3e8}
*{box-sizing:border-box}
body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#fff;
 margin:0;padding:20px 16px 40px;max-width:640px;margin-inline:auto}
h1{font-size:20px;margin:0 0 4px}
h2{font-size:13px;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin:22px 0 6px;font-weight:700}
a.f{display:flex;align-items:center;gap:11px;padding:12px 13px;border:1px solid var(--line);
 border-radius:9px;margin:7px 0;text-decoration:none;color:var(--ink);background:#fff}
a.f:hover{background:#f5f7fa;border-color:#b9c0c9}
.f .ic{flex:none;width:20px;display:flex}
.f .nm{flex:1;font-size:15px;font-weight:600}
.f .pg{flex:none;font-size:12px;color:var(--mut)}
footer{margin-top:26px;color:var(--mut);font-size:11.5px;line-height:1.55}"""
DOT = '<svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="5.5" fill="#c08a00"/></svg>'
(H/"index.html").write_text(f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
<meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">
<title>Eschede</title><style>{CSS}</style></head><body>
<h1>Eschede &mdash; 3 June 1998</h1>
<h2>UMT 312 term paper</h2>
<a class="f" href="slides.html?v={v}"><span class="ic">{DOT}</span>
<span class="nm">Slide deck</span><span class="pg">18 boards</span></a>
<footer>2 December 2026, 09:30 &middot; 30 minute slot, 21 minutes speaking &middot;
boards 1&ndash;9 Chidambar, 10&ndash;18 Akarsh.<br>
Built {built}. Single file &middot; nothing stored on your device &middot; no external request.
Arrow keys or click to move; <b>f</b> full screen, <b>e</b> extra notes, <b>d</b> dark.</footer>
</body></html>""")
print(f"index.html -> slides.html?v={v}")

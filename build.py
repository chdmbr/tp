#!/usr/bin/env python3
"""Eschede term-paper page: one self-contained deck, one minimal index.
Nothing stored on the device, no external request, content hash on the link.

The shared file box is published HERE, at /tp/chat/, so the address bar shows this site and not
the machine that actually stores the files. GitHub Pages cannot accept an upload -- it answers
405 to a POST -- so the page is static here and talks to the file server in the background. That
server's address is therefore inside chat/room.js, readable by anyone who opens the page source:
the address bar is hidden, the host is not. The room's real guard is its PIN.

The page is GENERATED from the room app's own files (/home/apps/chat/public), never hand-copied,
so the published copy cannot drift from the one the server serves. It is built only if room.txt
exists next to this script, holding the room URL on one line; without it the existing chat/ is
left untouched and the link is simply absent from the index.
"""
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
# A speech bubble, for the shared box -- the "chat-like symbol" the room is reached by.
BOX = ('<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#c08a00" '
       'stroke-width="1.6" stroke-linejoin="round"><path d="M3 5.2A1.7 1.7 0 0 1 4.7 3.5h10.6'
       'A1.7 1.7 0 0 1 17 5.2v6.6a1.7 1.7 0 0 1-1.7 1.7H8l-4 3.2v-3.2h-.3A1.7 1.7 0 0 1 3 11.8Z"/>'
       '<path d="M10 6.4v4.2M8 8.4l2-2 2 2"/></svg>')

_room = (H/"room.txt")
_url = _room.read_text().strip() if _room.exists() else ""

if _url:
    # ".../room/<id>" -> the host that serves the files, and the room's id.
    _api, _, _id = _url.rstrip("/").partition("/room/")
    src = pathlib.Path("/home/apps/chat/public")
    out = H/"chat"
    out.mkdir(exist_ok=True)
    # The page and the script, taken from the app itself. Two edits: the script tag becomes a
    # sibling path (there is no /js/ here), and a config line tells the script which server to
    # ask, since it can no longer work that out from its own address.
    page = (src/"room.html").read_text().replace(
        '<script src="/js/room.js"></script>',
        f'<script>window.ROOM={{api:"{_api}",id:"{_id}"}}</script>\n<script src="room.js"></script>',
    )
    (out/"index.html").write_text(page)
    (out/"room.js").write_text((src/"js"/"room.js").read_text())
    _link = "chat/"
ROOM = (f'<h2>Shared files</h2>\n<a class="f" href="{_link}"><span class="ic">{BOX}</span>'
        '<span class="nm">File box</span><span class="pg">drop &amp; take</span></a>') if _url else ""

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
{ROOM}
<footer>2 December 2026, 09:30 &middot; 30 minute slot, 21 minutes speaking &middot;
boards 1&ndash;9 Chidambar, 10&ndash;18 Akarsh.<br>
Built {built}. Single file &middot; nothing stored on your device &middot; no external request.
Arrow keys or click to move; <b>f</b> full screen, <b>e</b> extra notes, <b>d</b> dark.</footer>
</body></html>""")
print(f"index.html -> slides.html?v={v}" + (f"  + file box at chat/ (server {_api})" if _url else "  (no room.txt: no file box link)"))

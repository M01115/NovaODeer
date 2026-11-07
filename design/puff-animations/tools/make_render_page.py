"""Builds _render.html next to puff-expressions.html: the same page plus render-api.js, used by record.mjs.

Run from anywhere:  python design/puff-animations/tools/make_render_page.py
"""
from pathlib import Path

tools = Path(__file__).resolve().parent
root = tools.parent
page = (root / "puff-expressions.html").read_text(encoding="utf-8")
api = (tools / "render-api.js").read_text(encoding="utf-8")
out = root / "_render.html"
out.write_text(page.replace("</body>", f"<script>\n{api}\n</script>\n</body>", 1), encoding="utf-8")
print(out)

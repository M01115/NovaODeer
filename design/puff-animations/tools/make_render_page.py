"""Builds _render.html next to puff-expressions.html: the same page plus render-api.js and lottie-api.js,
used by record.mjs (frames) and export_lottie.mjs (Lottie JSON).

Run from anywhere:  python design/puff-animations/tools/make_render_page.py
"""
from pathlib import Path

tools = Path(__file__).resolve().parent
root = tools.parent
page = (root / "puff-expressions.html").read_text(encoding="utf-8")
scripts = "".join(f"<script>\n{(tools / n).read_text(encoding='utf-8')}\n</script>\n" for n in ("render-api.js", "lottie-api.js"))
out = root / "_render.html"
out.write_text(page.replace("</body>", scripts + "</body>", 1), encoding="utf-8")
print(out)

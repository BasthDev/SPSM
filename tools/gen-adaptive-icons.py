"""Generate Android adaptive icon assets dari assets/images/logo.png.

Foreground: logo di tengah kanvas transparan 1024x1024 (safe zone ~66%).
Monochrome: silhouette alpha-only (untuk themed icons Android 13+).
Background: solid color sesuai app.json android.adaptiveIcon.backgroundColor.
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "images" / "logo.png"
OUT = ROOT / "assets" / "images"
SIZE = 1024
BG_COLOR = (0xE6, 0xF4, 0xFE, 255)  # #E6F4FE — samakan dgn app.json

logo = Image.open(SRC).convert("RGBA")
# buang background putih/solid di sekitar logo bila ada: crop ke bounding box alpha
alpha = logo.getchannel("A")
bbox = alpha.getbbox()
if bbox:
    logo = logo.crop(bbox)

# ---- foreground: logo ~50% kanvas, centered ----
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
target = int(SIZE * 0.50)
logo_fg = logo.copy()
logo_fg.thumbnail((target, target), Image.LANCZOS)
pos = ((SIZE - logo_fg.width) // 2, (SIZE - logo_fg.height) // 2)
fg.alpha_composite(logo_fg, pos)
fg.save(OUT / "android-icon-foreground.png")

# ---- monochrome: silhouette hitam dari alpha ----
mono_logo = Image.new("RGBA", logo.size, (0, 0, 0, 255))
mono_logo.putalpha(logo.getchannel("A"))
mono = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
mono_logo.thumbnail((target, target), Image.LANCZOS)
mpos = ((SIZE - mono_logo.width) // 2, (SIZE - mono_logo.height) // 2)
mono.alpha_composite(mono_logo, mpos)
mono.save(OUT / "android-icon-monochrome.png")

# ---- background: solid ----
bg = Image.new("RGBA", (SIZE, SIZE), BG_COLOR)
bg.save(OUT / "android-icon-background.png")

print("OK ->", OUT)

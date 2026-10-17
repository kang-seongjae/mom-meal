"""앱 아이콘(밥그릇 모양) PNG 생성. 사용법: python -I tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (200, 85, 61)
FG = (255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"


def draw(size, maskable):
    s = 4  # 안티에일리어싱용 확대
    W = size * s
    img = Image.new("RGB", (W, W), BG)
    d = ImageDraw.Draw(img)
    pad = W * (0.2 if maskable else 0.12)  # maskable 은 가장자리가 잘려도 되도록 안쪽으로
    inner = W - 2 * pad
    cx = W / 2
    # 그릇
    top = pad + inner * 0.45
    d.pieslice([pad, top - inner * 0.42, W - pad, top + inner * 0.42], 0, 180, fill=FG)
    d.rectangle([pad, top - inner * 0.02, W - pad, top + inner * 0.02], fill=FG)
    d.rounded_rectangle([cx - inner * 0.16, top + inner * 0.38, cx + inner * 0.16, top + inner * 0.47],
                        radius=inner * 0.03, fill=FG)
    # 김
    w = max(2, int(inner * 0.045))
    for dx in (-0.2, 0, 0.2):
        x = cx + inner * dx
        y0 = pad + inner * 0.02
        pts = [(x + inner * 0.04 * ((i % 2) * 2 - 1), y0 + inner * 0.09 * i) for i in range(4)]
        d.line(pts, fill=FG, width=w, joint="curve")
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    draw(192, False).save(OUT / "icon-192.png")
    draw(512, False).save(OUT / "icon-512.png")
    draw(512, True).save(OUT / "icon-maskable-512.png")
    print("ok")

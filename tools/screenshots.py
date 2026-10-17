"""폰 화면 크기(390x844, 2배 해상도)로 주요 화면을 찍는다. 사용법: python -I tools/screenshots.py <저장폴더>"""
import sys
import tempfile
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import run_browser, start_server
from PIL import Image

W, H = 390, 844  # 일반적인 폰 화면 (CSS px)

SHOTS = {
    "1-home": "home",
    "2-meal-search": "meal?q=죽",
    "3-amount-sheet": "meal?food=D711-508000000-0001",          # 감자조림: 칼륨 많음
    "4-amount-no-potassium": "meal?food=D202-120000000-4493",   # 칼륨 정보 없음
    "5-weight": "weight",
    "6-settings": "settings",
    "7-empty-home": None,                                       # 기록이 하나도 없을 때
    "8-home-dark-mode-phone": "home",                           # 폰이 다크 모드일 때도 밝게 보이는지
    "9-home-one-weight": "home&one=1",                          # 체중 기록이 하나뿐일 때 그래프 라벨
    "10-amount-count-unit": "meal?food=D327-758010000-0001",    # 삶은 달걀: 1개 = 50g
    "11-amount-recipe": "meal?food=my-sample-recipe",           # 직접 만든 음식: 칼륨 일부 정보 없음
    "12-recipe-editor": "recipe?id=my-sample-recipe",
    "13-label-form": "label?id=new",                             # 직접 입력: 빈칸으로 시작
    "14-amount-label-draft": "meal?food=my-sample-draft",        # 수치 입력 전에는 기록 불가
}
# 폰 다크 모드 + 브라우저의 '웹페이지 자동 어둡게' 기능을 켠 상태
DARK_FLAGS = ["--force-dark-mode", "--enable-features=WebContentsForceDark"]


def main(out_dir):
    out = Path(out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    srv, base = start_server()
    for name, go in SHOTS.items():
        if go:
            route, _, extra_q = go.partition("&")
            inner = f"{base}/tests/seed.html?go=" + urllib.parse.quote(route) + (f"&{extra_q}" if extra_q else "")
        else:
            inner = f"{base}/index.html#home"
        # 헤드리스 창은 약 500px 보다 좁아지지 않으므로 390px 틀(frame.html) 안에서 찍고 잘라낸다.
        url = f"{base}/tests/frame.html?w={W}&h={H}&src=" + urllib.parse.quote(inner, safe="")
        png = out / (name + ".png")
        with tempfile.TemporaryDirectory() as prof:
            extra = DARK_FLAGS if "dark-mode" in name else []
            run_browser([*extra, f"--window-size=600,{H + 200}", "--force-device-scale-factor=2",
                         "--virtual-time-budget=10000", f"--screenshot={png}", url], prof)
        Image.open(png).crop((0, 0, W * 2, H * 2)).save(png)
        print(png)
    srv.shutdown()


if __name__ == "__main__":
    main(sys.argv[1])

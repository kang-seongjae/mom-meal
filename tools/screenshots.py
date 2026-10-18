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
    # 처음 시작 (아무 기록 없음 / 예전 화면에서 쓰던 기록이 있음)
    "01-start-meals": "start&fresh=1",
    "02-start-pet": "start&fresh=1&@click=%23s-next%7C%5Bdata-pet%3Dbear%5D",
    "03-start-weight": "start&legacy=1&@click=%23s-next%7C%5Bdata-pet%3Dbear%5D%7C%23s-next",
    # 성장 단계 (처음 52kg, 목표 56kg: 0.5kg 마다 한 단계, 모두 8단계)
    "04-stage0-baby": "today&kg=52.3&n=1",
    "05-stage1-sprout": "today&kg=53.1&n=2",
    "06-stage2-scarf": "today&kg=54.1&n=2",
    "07-stage3-flower": "today&kg=55.2&n=3",
    "08-stage4-final": "today&kg=56&n=2",
    # 오늘 다 먹은 날, 몸무게가 줄어든 날, 칼륨 주의 음식을 적은 때, 다 채우는 순간
    "09-meals-done-happy": "today&kg=54.1&n=4",
    "10-weight-drop-cheer": "today&kg=54.1&drop=1&n=2",
    "11-caution-note": "today&kg=53.1&n=1&@click=%5Bdata-quick%3D%22%EB%B0%94%EB%82%98%EB%82%98%EC%9A%B0%EC%9C%A0%22%5D",
    "12-celebrate-done": "today&kg=53.1&n=3&@click=%5Bdata-quick%5D&hold=1",
    "13-records": "records&kg=54.1",
    "14-settings": "settings&kg=54.1",
    "15-today-dark-mode-phone": "today&kg=54.1",
    # 네 친구의 다섯 가지 모습 모아 보기
    "16-pets-gallery": "/tests/pets.html",
}
# 폰 다크 모드 + 브라우저의 '웹페이지 자동 어둡게' 기능을 켠 상태
DARK_FLAGS = ["--force-dark-mode", "--enable-features=WebContentsForceDark"]


def main(out_dir):
    out = Path(out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    srv, base = start_server()
    for name, go in SHOTS.items():
        frame_q = ""
        if go and go.startswith("/"):
            inner = base + go
        elif go:
            route, _, rest = go.partition("&")
            # "@"로 시작하는 값은 틀(frame.html)에 넘기고, 나머지는 예시 기록 페이지(seed.html)에 넘긴다
            extra = [x for x in rest.split("&") if x and not x.startswith("@")]
            frame_q = "".join(f"&{x[1:]}" for x in rest.split("&") if x.startswith("@"))
            frame_q += "".join(f"&{x}" for x in extra if x.startswith("hold="))
            seed_q = [x for x in extra if not x.startswith("hold=")]
            inner = f"{base}/tests/seed.html?go=" + urllib.parse.quote(route) + "".join(f"&{x}" for x in seed_q)
        else:
            inner = f"{base}/index.html#home"
        # 헤드리스 창은 약 500px 보다 좁아지지 않으므로 390px 틀(frame.html) 안에서 찍고 잘라낸다.
        url = f"{base}/tests/frame.html?w={W}&h={H}{frame_q}&src=" + urllib.parse.quote(inner, safe="")
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

"""tests/test.html, tests/e2e.html 을 헤드리스 Edge 로 실행해 결과를 출력한다. 사용법: python -I tools/run_tests.py"""
import html
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import run_browser, start_server

PAGES = ["tests/test.html", "tests/e2e.html"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    srv, base = start_server()
    all_ok = True
    for page in PAGES:
        with tempfile.TemporaryDirectory() as prof:
            r = run_browser(["--virtual-time-budget=60000", "--dump-dom", f"{base}/{page}"], prof)
        dom = r.stdout.decode("utf-8", "replace")
        m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
        out = html.unescape(m.group(1)) if m else "(결과를 읽지 못함)\n" + dom[:2000]
        print(f"== {page}\n{out}\n")
        all_ok &= bool(re.search(r"SUMMARY: \d+ passed, 0 failed", out))
    srv.shutdown()
    all_ok &= sw_files_check()
    all_ok &= offline_check()
    all_ok &= readability_check()
    sys.exit(0 if all_ok else 1)


def sw_files_check():
    """앱이 쓰는 파일이 모두 서비스 워커 저장 목록(sw.js FILES)에 있어야 인터넷 없이 열린다."""
    root = Path(__file__).resolve().parent.parent
    listed = set(re.findall(r"'\./([^']+)'", (root / "sw.js").read_text(encoding="utf-8")))
    needed = {"index.html", "app.css", "manifest.webmanifest"}
    needed |= {f"js/{p.name}" for p in (root / "js").glob("*.js")}
    needed |= {f"icons/{p.name}" for p in (root / "icons").glob("*.png")}
    missing = sorted(needed - listed)
    print("== 오프라인 저장 목록")
    print(("FAIL | sw.js 에 빠진 파일: " + ", ".join(missing)) if missing else f"PASS | 앱 파일 {len(needed)}개 모두 들어 있음")
    print()
    return not missing


# 어르신이 보기 편하도록 지켜야 하는 최소값 (tests/measure.html 이 화면마다 잰다)
MIN_FONT_PX = 19       # 화면에 보이는 가장 작은 글씨 (그래프 눈금 제외)
MIN_CONTRAST = 7.0     # 글자와 배경의 밝기 대비
MIN_TARGET_PX = 48     # 누르는 버튼·입력칸의 가장 짧은 변


def readability_check():
    srv, base = start_server()
    with tempfile.TemporaryDirectory() as prof:
        r = run_browser(["--virtual-time-budget=120000", "--dump-dom", f"{base}/tests/measure.html"], prof)
    srv.shutdown()
    dom = r.stdout.decode("utf-8", "replace")
    m = re.search(r'<pre id="out">(.*?)\nDONE</pre>', dom, re.S)
    print("== 글씨 크기·대비·버튼 크기")
    if not m:
        print("FAIL | 측정 결과를 읽지 못함\n")
        return False
    ok = True
    for row in json.loads(html.unescape(m.group(1))):
        problems = []
        if row["minFont"] < MIN_FONT_PX:
            problems.append(f"글씨 {row['minFont']}px ({row['minFontText']})")
        if row["minContrast"] < MIN_CONTRAST:
            problems.append(f"대비 {row['minContrast']}:1 ({row['minContrastText']})")
        if row["minTarget"] < MIN_TARGET_PX:
            problems.append(f"버튼 {row['minTarget']}px ({row['minTargetText']})")
        ok &= not problems
        print(f"{'FAIL' if problems else 'PASS'} | {row['screen']} | 최소 글씨 {row['minFont']}px, 대비 {row['minContrast']}:1, "
              f"버튼 {row['minTarget']}px" + (f" → {', '.join(problems)}" if problems else ""))
    print()
    return ok


def offline_check():
    """한 번 열어 서비스 워커가 파일을 저장하게 한 뒤, 서버를 끄고 같은 브라우저로 다시 열어 본다."""
    srv, base = start_server()
    with tempfile.TemporaryDirectory() as prof:
        # 서비스 워커가 파일 저장을 끝낼 시간을 주려고 인터넷이 될 때 두 번 연다
        for _ in range(2):
            run_browser(["--virtual-time-budget=30000", "--dump-dom", f"{base}/index.html#today"], prof)
        srv.shutdown()
        srv.server_close()
        r = run_browser(["--virtual-time-budget=30000", "--dump-dom", f"{base}/index.html#today"], prof)
    dom = r.stdout.decode("utf-8", "replace")
    # 처음 여는 브라우저라 '처음 시작' 화면과 하루 횟수 칸이 떠야 한다
    ok = "하루에 몇 번 드실까요" in dom and 'class="slot"' in dom
    print(f"== 오프라인 (서버를 끈 뒤 다시 열기)\n{'PASS' if ok else 'FAIL'} | 처음 시작 화면이 열림\n")
    return ok


if __name__ == "__main__":
    main()

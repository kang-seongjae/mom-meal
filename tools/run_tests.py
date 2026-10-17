"""tests/test.html, tests/e2e.html 을 헤드리스 Edge 로 실행해 결과를 출력한다. 사용법: python -I tools/run_tests.py"""
import html
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
    all_ok &= offline_check()
    sys.exit(0 if all_ok else 1)


def offline_check():
    """한 번 열어 서비스 워커가 파일을 저장하게 한 뒤, 서버를 끄고 같은 브라우저로 다시 열어 본다."""
    srv, base = start_server()
    with tempfile.TemporaryDirectory() as prof:
        run_browser(["--virtual-time-budget=30000", "--dump-dom", f"{base}/index.html#home"], prof)
        srv.shutdown()
        srv.server_close()
        r = run_browser(["--virtual-time-budget=30000", "--dump-dom",
                         f"{base}/index.html#meal?q=" + "%EC%A3%BD"], prof)  # 죽
    dom = r.stdout.decode("utf-8", "replace")
    results = len(re.findall(r'class="result"', dom))
    ok = results > 0
    print(f"== 오프라인 (서버를 끈 뒤 다시 열기)\n{'PASS' if ok else 'FAIL'} | 화면이 열리고 '죽' 검색 결과 {results}개\n")
    return ok


if __name__ == "__main__":
    main()

"""화면별 글씨 크기·글자 대비·버튼 크기를 재서 출력한다. 사용법: python -I tools/measure.py [결과.json]"""
import html
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import run_browser, start_server


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    srv, base = start_server()
    with tempfile.TemporaryDirectory() as prof:
        r = run_browser(["--virtual-time-budget=120000", "--dump-dom", f"{base}/tests/measure.html"], prof)
    srv.shutdown()
    dom = r.stdout.decode("utf-8", "replace")
    m = re.search(r'<pre id="out">(.*?)\nDONE</pre>', dom, re.S)
    if not m:
        sys.exit("측정 결과를 읽지 못했습니다:\n" + dom[:1500])
    rows = json.loads(html.unescape(m.group(1)))
    for row in rows:
        print(f"{row['screen']:<36} 본문 {row['bodyFont']:.0f}px | 가장 작은 글씨 {row['minFont']:.1f}px ({row['minFontText']})"
              f" | 가장 약한 대비 {row['minContrast']}:1 ({row['minContrastText']})"
              f" | 가장 작은 버튼 {row['minTarget']}px ({row['minTargetText']})")
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

"""테스트·스크린샷용 로컬 서버와 헤드리스 Edge 실행 도우미."""
import functools
import http.server
import os
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]


def find_browser():
    for p in [os.environ.get("BROWSER_BIN", "")] + EDGE_CANDIDATES:
        if p and Path(p).exists():
            return p
    raise SystemExit("Edge/Chrome 을 찾지 못했습니다. BROWSER_BIN 환경변수로 지정하세요.")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


Quiet.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                        ".js": "text/javascript", ".webmanifest": "application/manifest+json"}


def start_server():
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def run_browser(args, profile_dir):
    cmd = [find_browser(), "--headless=new", "--disable-gpu", "--no-first-run",
           "--hide-scrollbars", f"--user-data-dir={profile_dir}", *args]
    return subprocess.run(cmd, capture_output=True, timeout=120)

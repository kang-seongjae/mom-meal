"""테스트·스크린샷용 로컬 서버와 헤드리스 Edge 실행 도우미."""
import functools
import http.server
import os
import subprocess
import threading
import time
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

    # 브라우저의 일반 캐시가 오프라인 테스트를 대신 통과시키지 않도록, 저장은 서비스 워커만 하게 한다
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # /__slow?ms=8000 : 일부러 늦게 답하는 그림. 페이지 load 를 실제 시간만큼 늦춰서
    # 헤드리스 브라우저가 서비스 워커 설치를 끝낼 때까지 닫히지 않게 한다 (오프라인 테스트용)
    def do_GET(self):
        if self.path.startswith("/__slow"):
            ms = int(self.path.split("ms=")[-1]) if "ms=" in self.path else 5000
            time.sleep(min(ms, 20000) / 1000)
            body = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    # 테스트 브라우저가 연결을 먼저 끊어도 오류 메시지를 찍지 않는다
    def handle(self):
        try:
            super().handle()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass


Quiet.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                        ".js": "text/javascript", ".webmanifest": "application/manifest+json"}


def start_server(port=0):
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def run_browser(args, profile_dir):
    cmd = [find_browser(), "--headless=new", "--disable-gpu", "--no-first-run",
           "--hide-scrollbars", f"--user-data-dir={profile_dir}", *args]
    return subprocess.run(cmd, capture_output=True, timeout=120)

"""data.go.kr 표준데이터(15100070) 전체를 페이지의 'JSON 다운로드' 버튼과 같은 방식으로 받는다.

사용법: python -I tools/fetch_food_data.py <저장할.json>
"""
import json, sys, time, urllib.request, urllib.parse

PK = "15100070"
BASE = "https://www.data.go.kr"
sys.stderr.reconfigure(encoding="utf-8")
out = sys.argv[1]
UA = {"User-Agent": "Mozilla/5.0", "Referer": f"{BASE}/data/{PK}/standard.do",
      "X-Requested-With": "XMLHttpRequest"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

header = get(f"{BASE}/download/columList.json?pk={PK}&ext=JSON")
tv = header["tableVO"]
total = header["totalCount"]
print("fileName:", header.get("fileName"), "total:", total, file=sys.stderr)
records = []
page = 1
while len(records) < total:
    q = [("colNmList", c) for c in tv["colNmList"]] + [
        ("totalCount", total), ("svcTableNm", tv["svcTableNm"]), ("perPage", 10000), ("page", page)]
    data = get(f"{BASE}/download/standard.json?publicDataPk={PK}&" + urllib.parse.urlencode(q))
    rows = data if isinstance(data, list) else data.get("data") or data.get("records") or data.get("list")
    if page == 1 and not isinstance(data, list):
        print("page keys:", list(data.keys())[:10], file=sys.stderr)
    if not rows:
        break
    records.extend(rows)
    print("page", page, len(rows), "->", len(records), file=sys.stderr)
    page += 1
    time.sleep(0.5)

json.dump({"header": header, "records": records}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("saved", len(records), file=sys.stderr)

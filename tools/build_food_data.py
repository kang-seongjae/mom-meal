"""공공데이터포털 '전국통합식품영양성분정보(음식)표준데이터' 원본 JSON을 앱용 data/foods.json으로 변환한다.

사용법: python -I tools/build_food_data.py <원본.json> <내려받은날짜 YYYY-MM-DD>

원본 형식이 예상과 다르면 수치를 추측하지 않고 오류로 멈춘다.
"""
import json
import re
import sys
from pathlib import Path

REQUIRED = ["FOOD_CD", "FOOD_NM", "FOOD_ORIGIN_NM", "NUT_CON_SRTR_QUA", "ENERC", "PROT", "K",
            "FOOD_SIZE", "REST_NM", "FOOD_LV3_NM", "SRC_NM", "CRTR_YMD", "INSTT_NM"]
EXPECTED_HEADERS = {"ENERC": "에너지(kcal)", "PROT": "단백질(g)", "K": "칼륨(mg)",
                    "NUT_CON_SRTR_QUA": "영양성분함량기준량"}
NUM = re.compile(r"^\d+(\.\d+)?$")
ORIGIN_SHORT = [("가정식", "가정식"), ("프랜차이즈", "프랜차이즈"), ("외식", "외식"), ("산업체급식", "급식"),
                ("초등학교급식", "급식"), ("중고등학교급식", "급식")]


def origin_short(name):
    for key, short in ORIGIN_SHORT:
        if name.startswith(key) or key in name:
            return short
    return name


def fail(msg):
    sys.exit(f"[데이터 형식 오류] {msg}")


def num(v, field, code, allow_missing):
    if v is None or str(v).strip() == "":
        if allow_missing:
            return None  # 값 없음: 0으로 바꾸지 않는다
        fail(f"{code} 의 {field} 값이 비어 있음")
    s = str(v).strip()
    if not NUM.match(s):
        fail(f"{code} 의 {field} 값이 숫자가 아님: {s!r}")
    f = float(s)
    return int(f) if f.is_integer() else f


def main(src, downloaded):
    sys.stdout.reconfigure(encoding="utf-8")
    raw = json.loads(Path(src).read_text(encoding="utf-8"))
    header, records = raw["header"], raw["records"]

    names = {c["columCode"]: c["columNm"] for c in header["columList"]}
    for code in REQUIRED:
        if code not in names:
            fail(f"열 {code} 이(가) 없음")
    for code, nm in EXPECTED_HEADERS.items():
        if names[code] != nm:
            fail(f"열 {code} 이름이 예상과 다름: {names[code]!r} (예상 {nm!r})")
    if len(records) != header["totalCount"]:
        fail(f"건수 불일치: 받은 {len(records)} / 전체 {header['totalCount']}")

    foods, crtr, src_counts = [], set(), {}
    for r in records:
        code = r["FOOD_CD"]
        basis = r["NUT_CON_SRTR_QUA"]
        if basis not in ("100g", "100ml"):
            fail(f"{code} 기준량이 100g/100ml 가 아님: {basis!r}")
        unit = basis[3:]
        size = None
        m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(g|ml)", (r.get("FOOD_SIZE") or "").strip())
        if m and m.group(2) == unit:
            size = float(m.group(1))
            size = int(size) if size.is_integer() else size
        rest = r["REST_NM"] if r["REST_NM"] and r["REST_NM"] != "해당없음" else ""
        foods.append([
            code,
            r["FOOD_NM"].strip(),
            rest,
            r["FOOD_LV3_NM"],
            unit,
            num(r["ENERC"], "에너지", code, False),
            num(r["PROT"], "단백질", code, False),
            num(r["K"], "칼륨", code, True),
            size,
            r["SRC_NM"],
            origin_short(r["FOOD_ORIGIN_NM"]),
        ])
        crtr.add(r["CRTR_YMD"])
        src_counts[r["SRC_NM"]] = src_counts.get(r["SRC_NM"], 0) + 1

    if len(crtr) != 1:
        fail(f"데이터기준일자가 여러 개: {sorted(crtr)}")

    out = {
        "meta": {
            "title": "전국통합식품영양성분정보(음식)표준데이터",
            "provider": records[0]["INSTT_NM"],
            "database": "식품영양성분 데이터베이스 (식품의약품안전처)",
            "url": "https://www.data.go.kr/data/15100070/standard.do",
            "baseDate": crtr.pop(),
            "downloaded": downloaded,
            "count": len(foods),
            "sources": src_counts,
            "fields": ["code", "name", "rest", "category", "unit", "kcal", "protein",
                       "potassium", "size", "source", "origin"],
        },
        "foods": foods,
    }
    dst = Path(__file__).resolve().parent.parent / "data" / "foods.json"
    dst.parent.mkdir(exist_ok=True)
    dst.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    missing_k = sum(1 for f in foods if f[7] is None)
    print(f"{len(foods)}건 저장 → {dst} (칼륨 정보 없음 {missing_k}건, 기준일 {out['meta']['baseDate']})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

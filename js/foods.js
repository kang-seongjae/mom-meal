// 앱에 넣어 둔 식약처 음식 영양성분 데이터(data/foods.json) 불러오기와 검색.

let foods = [];
let byCode = new Map();
let meta = null;

export async function loadFoods(url = 'data/foods.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('음식 데이터를 불러오지 못했어요.');
  const data = await res.json();
  meta = data.meta;
  foods = data.foods.map(([code, name, rest, category, unit, kcal, protein, potassium, size, source, origin]) => ({
    code, name, rest, category, unit, kcal, protein, potassium, size, source, origin,
    key: normalize(name + ' ' + rest),
  }));
  byCode = new Map(foods.map((f) => [f.code, f]));
  return meta;
}

export function getFood(code) {
  return byCode.get(code) || null;
}

export function getMeta() {
  return meta;
}

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, '');
}

const ORIGIN_RANK = { 가정식: 0, 외식: 1, 급식: 2 };

// 이름이 정확히 맞는 음식, 업체명이 없는 일반 음식(가정식 먼저)을 먼저 보여준다.
export function searchFoods(query, limit = 40) {
  const q = normalize(query);
  if (!q) return [];
  const hits = [];
  for (const f of foods) {
    const i = f.key.indexOf(q);
    if (i < 0) continue;
    const name = normalize(f.name);
    // 음식 이름은 종류가 뒤에 붙는 경우가 많아(흰죽, 김밥) 끝이 맞는 것을 앞이 맞는 것보다 먼저 둔다.
    const match = name === q ? 0 : name.endsWith(q) ? 1 : name.startsWith(q) ? 2 : 3;
    const score = match * 10 + (f.rest ? 5 : ORIGIN_RANK[f.origin] ?? 3);
    hits.push([score, f.name.length, f]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return hits.slice(0, limit).map((h) => h[2]);
}

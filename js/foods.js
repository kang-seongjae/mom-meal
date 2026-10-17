// 앱에 넣어 둔 식약처 음식 영양성분 데이터(data/foods.json) 불러오기와 검색.
// 직접 만든 음식·직접 입력 음식도 같은 모양으로 함께 찾을 수 있게 등록한다.

let foods = [];
let byCode = new Map();
let custom = [];
let customByCode = new Map();
let meta = null;

export const SOURCE_LABEL = '직접 입력(제품 라벨)';
export const SOURCE_RECIPE = '직접 만든 음식';

export async function loadFoods(url = 'data/foods.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('음식 데이터를 불러오지 못했어요.');
  const data = await res.json();
  meta = data.meta;
  foods = data.foods.map(([code, name, rest, category, unit, kcal, protein, potassium, size, source, origin]) => ({
    code, name, rest, category, unit, basis: 100, kcal, protein, potassium, potassiumPartial: false,
    size, source, origin, custom: null,
    key: normalize(name + ' ' + rest),
  }));
  byCode = new Map(foods.map((f) => [f.code, f]));
  return meta;
}

// state.customFoods 를 음식 목록 모양으로 바꿔 등록한다.
export function setCustomFoods(list) {
  custom = list.map((c) => {
    const recipe = c.kind === 'recipe';
    return {
      code: c.code, name: c.name, rest: '',
      category: recipe ? SOURCE_RECIPE : SOURCE_LABEL,
      unit: recipe ? '인분' : (c.unit || 'g'),
      basis: recipe ? 1 : c.basis,          // 1인분당 / 라벨 기준량당 (라벨을 아직 안 채웠으면 null)
      kcal: c.kcal ?? null, protein: c.protein ?? null, potassium: c.potassium ?? null,
      potassiumPartial: !!c.potassiumPartial,
      size: null,
      source: recipe ? SOURCE_RECIPE : SOURCE_LABEL,
      origin: recipe ? SOURCE_RECIPE : SOURCE_LABEL,
      custom: c.kind,
      items: c.items,
      key: normalize(c.name),
    };
  });
  customByCode = new Map(custom.map((f) => [f.code, f]));
}

export function getFood(code) {
  return customByCode.get(code) || byCode.get(code) || null;
}

export function getMeta() {
  return meta;
}

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, '');
}

const ORIGIN_RANK = { 가정식: 0, 외식: 1, 급식: 2 };

// 직접 등록한 음식을 맨 앞에, 그다음 이름이 정확히 맞는 음식, 업체명이 없는 일반 음식(가정식 먼저) 순서.
// kinds: 찾을 종류 ('data', 'recipe', 'label')
export function searchFoods(query, limit = 40, kinds = ['data', 'recipe', 'label']) {
  const q = normalize(query);
  if (!q) return [];
  const hits = [];
  const pool = [
    ...custom.filter((f) => kinds.includes(f.custom)),
    ...(kinds.includes('data') ? foods : []),
  ];
  for (const f of pool) {
    const i = f.key.indexOf(q);
    if (i < 0) continue;
    const name = normalize(f.name);
    // 음식 이름은 종류가 뒤에 붙는 경우가 많아(흰죽, 김밥) 끝이 맞는 것을 앞이 맞는 것보다 먼저 둔다.
    const match = name === q ? 0 : name.endsWith(q) ? 1 : name.startsWith(q) ? 2 : 3;
    const score = (f.custom ? -100 : 0) + match * 10 + (f.rest ? 5 : ORIGIN_RANK[f.origin] ?? 3);
    hits.push([score, f.name.length, f]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return hits.slice(0, limit).map((h) => h[2]);
}

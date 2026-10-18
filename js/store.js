// 기록은 이 폰의 브라우저(localStorage)에만 저장한다.
import { DEFAULT_SETTINGS, validateBackup, validateSettingsBackup, normalizeMeal } from './calc.js';
import { defaultGrow, validateGrow, parseMealsPerDay } from './grow.js';

const KEY = 'momMeal.v1';

function empty() {
  return {
    app: 'mom-meal',
    version: 1,
    // {id, date, time, code, name, rest, unit, amount, amountLabel, basis, per:{kcal, protein, potassium, potassiumPartial}}
    meals: [],
    weights: [],     // {id, date, time, kg, timing}
    favorites: [],   // 음식 코드
    servings: {},    // 음식 코드 -> 한 그릇(잔) g/ml
    units: {},       // 음식 코드 -> 개수 단위 {name: '개', amount: 50}
    customFoods: [], // 직접 만든 음식(kind 'recipe'), 제품 라벨을 보고 직접 입력한 음식(kind 'label')
    settings: { ...DEFAULT_SETTINGS },
    grow: defaultGrow(), // 캐릭터 키우기 (친구, 하루 횟수, 시작 몸무게, 오늘 먹은 음식, 주의 음식)
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    return {
      ...empty(), ...s,
      meals: (s.meals || []).map(normalizeMeal),
      settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
      grow: { ...defaultGrow(), ...(s.grow || {}) },
    };
  } catch {
    return empty();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function exportJson(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
}

// 설정만 내보내기: 식사·체중 기록은 빼고 다른 폰에서 그대로 쓸 수 있는 것만 담는다.
export function exportSettingsJson(state) {
  const { goalLow, goalHigh, kLow, kHigh, timings } = state.settings;
  return JSON.stringify({
    app: 'mom-meal',
    kind: 'settings',
    version: 1,
    favorites: state.favorites,
    customFoods: state.customFoods,
    units: state.units,
    servings: state.servings,
    settings: { goalLow, goalHigh, kLow, kHigh, timings },
    // 키우기 설정 (시작 몸무게와 음식 기록은 넣지 않는다)
    growSettings: (({ mealsPerDay, pet, name, cautionWords }) => ({ mealsPerDay, pet, name, cautionWords }))(state.grow || defaultGrow()),
    exportedAt: new Date().toISOString(),
  }, null, 1);
}

function parseFile(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('파일을 읽을 수 없어요. 백업 파일이 맞는지 확인해 주세요.');
  }
}

// 백업 파일을 읽어 종류를 알려 준다. 전체 백업이면 바꿀 상태, 설정 파일이면 합친 상태와 요약.
export function readBackupFile(text, state) {
  const obj = parseFile(text);
  if (obj && obj.kind === 'settings') {
    validateSettingsBackup(obj);
    validateGrowSettings(obj.growSettings);
    return { kind: 'settings', ...mergeSettings(state, obj) };
  }
  return { kind: 'full', state: importJson(text) };
}

const sameName = (a, b) => a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');

// 설정 파일을 지금 상태에 합친다. 식사·체중 기록은 건드리지 않는다.
// 같은 음식(코드가 같거나, 종류와 이름이 같음)은 추가하지 않고 기존 음식을 쓴다.
export function mergeSettings(state, obj) {
  const customFoods = [...state.customFoods];
  const codeMap = {};   // 가져온 코드 -> 이 폰의 코드
  const added = [];
  const skipped = [];
  // 라벨 음식을 먼저 합쳐야, 그 라벨을 재료로 쓴 만든 음식의 재료 코드를 바꿀 수 있다.
  const incoming = [...obj.customFoods].sort((a, b) => (a.kind === 'label' ? 0 : 1) - (b.kind === 'label' ? 0 : 1));
  for (const c of incoming) {
    const dup = customFoods.find((e) => e.code === c.code || (e.kind === c.kind && sameName(e.name, c.name)));
    if (dup) {
      codeMap[c.code] = dup.code;
      skipped.push(c.name);
      continue;
    }
    const copy = JSON.parse(JSON.stringify(c));
    if (copy.kind === 'recipe') copy.items = copy.items.map((it) => ({ ...it, code: codeMap[it.code] ?? it.code }));
    customFoods.push(copy);
    added.push(copy.name);
  }
  const map = (code) => codeMap[code] ?? code;

  const favorites = [...state.favorites];
  let favoritesAdded = 0;
  for (const code of obj.favorites.map(map)) {
    if (!favorites.includes(code)) {
      favorites.push(code);
      favoritesAdded += 1;
    }
  }
  const units = { ...state.units };
  for (const [code, u] of Object.entries(obj.units || {})) units[map(code)] = u;
  const servings = { ...state.servings };
  for (const [code, v] of Object.entries(obj.servings || {})) servings[map(code)] = v;

  // 목표 체중·칼륨 기준값·측정 시점은 값이 하나뿐이라 가져온 값으로 바꾼다.
  const { goalLow, goalHigh, kLow, kHigh, timings } = obj.settings;
  // 키우기: 하루 횟수·친구는 파일 값으로, 주의 음식은 합친다 (같은 이름은 한 번만)
  const grow = { ...(state.grow || defaultGrow()) };
  const gs = obj.growSettings;
  if (gs) {
    if (gs.mealsPerDay !== undefined) grow.mealsPerDay = gs.mealsPerDay;
    if (gs.pet && !grow.pet) grow.pet = gs.pet;
    if (gs.name && !grow.name) grow.name = gs.name;   // 이미 지어 준 이름은 그대로
    const words = [...(grow.cautionWords || [])];
    for (const w of gs.cautionWords || []) if (!words.some((x) => sameName(x, w))) words.push(w);
    grow.cautionWords = words;
  }
  return {
    state: {
      ...state,
      favorites, customFoods, units, servings, grow,
      settings: { ...state.settings, goalLow, goalHigh, kLow, kHigh, timings },
    },
    report: {
      added, skipped, favoritesAdded,
      unitCount: Object.keys(obj.units || {}).length,
      servingCount: Object.keys(obj.servings || {}).length,
    },
  };
}

// 형식이 맞을 때만 새 상태를 돌려준다. 틀리면 throw.
export function importJson(text) {
  const obj = parseFile(text);
  validateBackup(obj);
  validateGrow(obj.grow);
  const s = empty();
  return {
    ...s,
    meals: obj.meals.map(normalizeMeal),
    weights: obj.weights,
    favorites: obj.favorites,
    servings: obj.servings || {},
    units: obj.units || {},
    customFoods: obj.customFoods || [],
    settings: { ...DEFAULT_SETTINGS, ...(obj.settings || {}) },
    grow: { ...defaultGrow(), ...(obj.grow || {}) },
  };
}

function validateGrowSettings(gs) {
  if (gs === undefined) return;
  if (typeof gs !== 'object' || gs === null) throw new Error('키우기 설정 형식이 맞지 않아요.');
  if (gs.mealsPerDay !== undefined) parseMealsPerDay(gs.mealsPerDay);
  validateGrow({ pet: gs.pet, name: gs.name, cautionWords: gs.cautionWords });
}

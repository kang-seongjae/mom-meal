// 기록은 이 폰의 브라우저(localStorage)에만 저장한다.
import { DEFAULT_SETTINGS, validateBackup } from './calc.js';

const KEY = 'momMeal.v1';

function empty() {
  return {
    app: 'mom-meal',
    version: 1,
    meals: [],      // {id, date, time, code, name, rest, unit, amount, per100:{kcal, protein, potassium}}
    weights: [],    // {id, date, time, kg, timing}
    favorites: [],  // 음식 코드
    servings: {},   // 음식 코드 -> 한 그릇(잔) g/ml
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    return { ...empty(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
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

// 형식이 맞을 때만 새 상태를 돌려준다. 틀리면 throw.
export function importJson(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('파일을 읽을 수 없어요. 백업 파일이 맞는지 확인해 주세요.');
  }
  validateBackup(obj);
  const s = empty();
  return {
    ...s,
    meals: obj.meals,
    weights: obj.weights,
    favorites: obj.favorites,
    servings: obj.servings || {},
    settings: { ...DEFAULT_SETTINGS, ...(obj.settings || {}) },
  };
}

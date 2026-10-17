// 화면과 상관없는 계산만 모아 둔 모듈. tests/test.html 에서 그대로 검사한다.

export const DEFAULT_SETTINGS = {
  goalLow: null,   // 목표 체중은 기본값 없이 설정에서 입력한다
  goalHigh: null,
  kLow: 100,   // 이 값 미만이면 "적음"
  kHigh: 200,  // 이 값 이상이면 "많음", 그 사이는 "보통"
  timings: ['아침', '저녁', '기타'],  // 체중 측정 시점. 설정에서 바꿀 수 있다
};

// 목표 체중 표시: "55~57kg" 또는 "55kg". 입력 전이면 null.
export function goalText(settings) {
  const { goalLow, goalHigh } = settings;
  if (goalLow == null) return null;
  return goalHigh != null && goalHigh !== goalLow ? `${goalLow}~${goalHigh}kg` : `${goalLow}kg`;
}

// 설정 화면의 목표 체중 입력값 검사. 둘 다 비우면 목표 없음, 하나만 쓰면 그 값 하나가 목표.
export function parseGoal(lowText, highText) {
  const low = String(lowText).trim() === '' ? null : Number(lowText);
  const high = String(highText).trim() === '' ? null : Number(highText);
  if (low == null && high == null) return { goalLow: null, goalHigh: null };
  const a = low ?? high, b = high ?? low;
  if (!(a > 0 && b > 0) || b < a) throw new Error('목표 체중을 확인해 주세요.');
  return { goalLow: a, goalHigh: b };
}

// 측정 시점 입력("아침, 저녁, 기타") 정리. 빈 값은 빼고 중복 제거, 최대 6개.
export function parseTimings(text) {
  const list = [...new Set(String(text).split(',').map((s) => s.trim()).filter(Boolean))];
  if (!list.length) throw new Error('측정 시점을 하나 이상 입력해 주세요.');
  if (list.length > 6 || list.some((s) => s.length > 10)) throw new Error('측정 시점은 10글자 이하로 6개까지 쓸 수 있어요.');
  return list;
}

// 기기 시간대 기준 날짜 문자열. toISOString()은 UTC라 한국 아침 기록이 전날로 밀린다.
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

// basis(기본 100g·100ml) 당 값을 실제 먹은 양으로 환산. 값이 없으면 null 그대로 둔다.
// 직접 만든 음식은 basis 1(1인분당), 라벨로 입력한 음식은 라벨 기준량(예: 200ml)당 값이다.
export function scale(per, amount, basis = 100) {
  if (per === null || per === undefined) return null;
  return (per * amount) / basis;
}

// "한 그릇 = N g" 설정으로 그릇 수를 그램으로 바꾼다.
export function servingsToAmount(servings, gramsPerServing) {
  return servings * gramsPerServing;
}

// 예전 기록({per100})을 지금 형식({per, basis})으로 바꾼다.
export function normalizeMeal(m) {
  if (m.per) return { ...m, basis: m.basis ?? 100 };
  const { per100, ...rest } = m;
  return { ...rest, per: per100, basis: 100 };
}

// meal: {amount, basis, per: {kcal, protein, potassium, potassiumPartial}}
export function mealNutrients(meal) {
  const per = meal.per ?? meal.per100;
  const basis = meal.basis ?? 100;
  return {
    kcal: scale(per.kcal, meal.amount, basis),
    protein: scale(per.protein, meal.amount, basis),
    potassium: scale(per.potassium, meal.amount, basis),
    potassiumPartial: !!per.potassiumPartial,  // 재료 중 일부만 칼륨 값이 있음
  };
}

// 하루 합계. 칼륨은 값이 있는 만큼만 더하고, 값이 없거나 일부만 있는 음식 수를 따로 센다.
export function dayTotals(meals, date) {
  const t = { count: 0, kcal: 0, protein: 0, potassiumKnown: 0, potassiumMissing: 0 };
  for (const m of meals) {
    if (m.date !== date) continue;
    const n = mealNutrients(m);
    t.count += 1;
    t.kcal += n.kcal ?? 0;
    t.protein += n.protein ?? 0;
    if (n.potassium === null) t.potassiumMissing += 1;
    else {
      t.potassiumKnown += n.potassium;
      if (n.potassiumPartial) t.potassiumMissing += 1;
    }
  }
  return t;
}

// 직접 만든 음식: 재료(각자 basis 당 값과 양)를 더해 1인분 값을 만든다.
// 칼륨은 값이 있는 재료만 더하고, 하나라도 없으면 potassiumPartial. 모두 없으면 null.
export function recipeNutrients(items) {
  let kcal = 0, protein = 0, potassium = 0, known = 0, missing = 0;
  for (const it of items) {
    const n = mealNutrients(it);
    if (n.kcal === null || n.protein === null) throw new Error(`${it.name ?? '재료'}의 칼로리·단백질 값이 없어요.`);
    kcal += n.kcal;
    protein += n.protein;
    if (n.potassium === null) missing += 1;
    else {
      potassium += n.potassium;
      known += 1;
      if (n.potassiumPartial) missing += 1;
    }
  }
  return {
    kcal, protein,
    potassium: known ? potassium : null,
    potassiumPartial: known > 0 && missing > 0,
    missingCount: missing,
  };
}

// 화면에 보일 칼륨 상태. 일부 정보만 있으면 아는 값만으로 '많음'인지 따로 알려 준다.
export function potassiumStatus(mg, partial, settings = DEFAULT_SETTINGS) {
  if (partial) return mg !== null && mg >= settings.kHigh ? 'partial-high' : 'partial';
  return potassiumLevel(mg, settings);
}

// 기준량·칼로리·단백질이 모두 있어야 기록할 수 있다 (라벨 음식은 수치를 비워 둔 채로 저장할 수 있어서).
export function isRecordable(food) {
  return food.kcal != null && food.protein != null && food.basis > 0;
}

function optionalNumber(text, label) {
  const t = String(text ?? '').trim();
  if (t === '') return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label} 값을 확인해 주세요.`);
  return v;
}

// "1개 = 50g" 같은 개수 단위. 둘 다 비우면 null(단위 없음).
export function parseCountUnit(name, amount) {
  const n = String(name ?? '').trim();
  const a = String(amount ?? '').trim();
  if (!n && !a) return null;
  if (!n || n.length > 5) throw new Error('단위 이름은 1~5글자로 써 주세요 (예: 개, 팩).');
  const v = Number(a);
  if (!(v > 0)) throw new Error(`1${n}의 양을 확인해 주세요.`);
  return { name: n, amount: v };
}

// 제품 라벨 직접 입력. 이름만 있으면 저장되고, 수치 칸은 비워 둘 수 있다
// (비우면 '정보 없음'이고 0으로 바꾸지 않는다. 기준량·칼로리·단백질이 채워져야 기록할 수 있다).
export function parseLabelFood(f) {
  const name = String(f.name ?? '').trim();
  if (!name || name.length > 30) throw new Error('음식 이름을 30글자 이내로 써 주세요.');
  const basis = optionalNumber(f.basis, '라벨 기준량');
  if (basis === 0) throw new Error('라벨 기준량은 0보다 커야 해요.');
  if (basis !== null && f.unit !== 'g' && f.unit !== 'ml') throw new Error('기준량 단위(g 또는 ml)를 골라 주세요.');
  return {
    name, basis, unit: f.unit === 'g' || f.unit === 'ml' ? f.unit : null,
    kcal: optionalNumber(f.kcal, '칼로리'),
    protein: optionalNumber(f.protein, '단백질'),
    potassium: optionalNumber(f.potassium, '칼륨'),
  };
}

// 오늘 이전 n일 중 기록이 있는 날만으로 평균을 낸다.
// 기록을 깜빡한 날을 0kcal로 치면 평균이 부당하게 낮아지기 때문.
export function recentAverage(meals, today, n = 7) {
  let days = 0, kcal = 0, protein = 0;
  for (let i = 1; i <= n; i++) {
    const t = dayTotals(meals, addDays(today, -i));
    if (t.count === 0) continue;
    days += 1;
    kcal += t.kcal;
    protein += t.protein;
  }
  if (days === 0) return null;
  return { days, kcal: kcal / days, protein: protein / days };
}

export function compareToday(meals, today) {
  const t = dayTotals(meals, today);
  const y = dayTotals(meals, addDays(today, -1));
  const avg = recentAverage(meals, today, 7);
  return {
    today: t,
    yesterday: y.count ? y : null,
    average: avg,
    moreThanYesterday: !!(y.count && t.count && t.kcal > y.kcal),
    moreThanAverage: !!(avg && t.count && t.kcal > avg.kcal),
    proteinMoreThanYesterday: !!(y.count && t.count && t.protein > y.protein),
    proteinMoreThanAverage: !!(avg && t.count && t.protein > avg.protein),
  };
}

// 칼륨 등급. mg 이 null 이면 0으로 치지 않고 'unknown'.
export function potassiumLevel(mg, settings = DEFAULT_SETTINGS) {
  if (mg === null || mg === undefined || Number.isNaN(mg)) return 'unknown';
  if (mg < settings.kLow) return 'low';
  if (mg < settings.kHigh) return 'mid';
  return 'high';
}

export const POTASSIUM_LABEL = {
  low: '적음', mid: '보통', high: '많음', unknown: '칼륨 정보 없음',
  partial: '칼륨 일부 정보 없음', 'partial-high': '칼륨 많음 (일부 정보 없음)',
};

export function latestWeight(weights) {
  if (!weights.length) return null;
  const key = (w) => w.date + ' ' + (w.time || '');
  return [...weights].sort((a, b) => key(a).localeCompare(key(b))).at(-1);
}

export function remainingToGoal(currentKg, goalLow) {
  if (currentKg == null || goalLow == null) return null;
  return Math.max(0, round1(goalLow - currentKg));
}

export function round1(x) {
  return Math.round(x * 10) / 10;
}

// 응원 문구. 특정 음식이나 의학적 행동을 권하지 않는다.
export function cheerMessage(cmp) {
  const { today } = cmp;
  if (today.count === 0) {
    return '오늘도 천천히, 드실 수 있는 만큼만요. 한 숟가락도 기록해 두면 힘이 돼요.';
  }
  if (cmp.moreThanYesterday && cmp.moreThanAverage) {
    return '어제보다, 지난 일주일보다 더 드셨어요. 정말 잘하셨어요!';
  }
  if (cmp.moreThanYesterday) return '어제보다 더 드셨어요. 정말 잘하셨어요!';
  if (cmp.moreThanAverage) return '지난 일주일 평균보다 더 드셨어요. 훌륭해요!';
  return '오늘 드신 것 하나하나가 다 소중해요. 기록해 주셔서 고마워요.';
}

// 백업 파일 검사. 형식이 맞지 않으면 이유를 담아 throw.
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('백업 파일이 아니에요.');
  if (obj.app !== 'mom-meal') throw new Error('이 앱의 백업 파일이 아니에요.');
  for (const k of ['meals', 'weights', 'favorites']) {
    if (!Array.isArray(obj[k])) throw new Error(`백업에 ${k} 목록이 없어요.`);
  }
  for (const m of obj.meals) {
    if (typeof m.date !== 'string' || typeof m.amount !== 'number' || !(m.per || m.per100)) {
      throw new Error('식사 기록 형식이 맞지 않아요.');
    }
  }
  validateFoodSettings(obj);
  for (const w of obj.weights) {
    if (typeof w.date !== 'string' || typeof w.kg !== 'number') {
      throw new Error('체중 기록 형식이 맞지 않아요.');
    }
  }
  return true;
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// 전체 백업과 설정 파일이 함께 쓰는 검사: 직접 등록한 음식, 개수 단위, 한 그릇 무게
function validateFoodSettings(obj) {
  if (obj.customFoods !== undefined) {
    if (!Array.isArray(obj.customFoods)) throw new Error('직접 등록한 음식 목록 형식이 맞지 않아요.');
    for (const c of obj.customFoods) {
      if (!isPlainObject(c) || typeof c.code !== 'string' || !c.code.startsWith('my-') || typeof c.name !== 'string'
        || !['recipe', 'label'].includes(c.kind)) {
        throw new Error('직접 등록한 음식 형식이 맞지 않아요.');
      }
      if (c.kind === 'recipe' && !Array.isArray(c.items)) throw new Error(`"${c.name}"의 재료 목록이 없어요.`);
    }
  }
  if (obj.units !== undefined) {
    if (!isPlainObject(obj.units)) throw new Error('개수 단위 형식이 맞지 않아요.');
    for (const u of Object.values(obj.units)) {
      if (!isPlainObject(u) || typeof u.name !== 'string' || !(u.amount > 0)) throw new Error('개수 단위 형식이 맞지 않아요.');
    }
  }
  if (obj.servings !== undefined) {
    if (!isPlainObject(obj.servings) || Object.values(obj.servings).some((v) => !(v > 0))) {
      throw new Error('한 그릇 무게 형식이 맞지 않아요.');
    }
  }
}

// 설정 파일(설정만 내보내기) 검사. 식사·체중 기록은 들어 있지 않아야 한다.
export function validateSettingsBackup(obj) {
  if (!isPlainObject(obj) || obj.app !== 'mom-meal' || obj.kind !== 'settings') {
    throw new Error('이 앱의 설정 파일이 아니에요.');
  }
  if ('meals' in obj || 'weights' in obj) throw new Error('설정 파일에 식사·체중 기록이 들어 있어요.');
  if (!Array.isArray(obj.favorites) || obj.favorites.some((c) => typeof c !== 'string')) {
    throw new Error('즐겨찾기 형식이 맞지 않아요.');
  }
  if (!Array.isArray(obj.customFoods)) throw new Error('직접 등록한 음식 목록이 없어요.');
  validateFoodSettings(obj);
  const s = obj.settings;
  if (!isPlainObject(s)) throw new Error('설정 값이 없어요.');
  const goal = (v) => v === null || (typeof v === 'number' && v > 0);
  if (!goal(s.goalLow) || !goal(s.goalHigh) || (s.goalLow !== null && s.goalHigh !== null && s.goalHigh < s.goalLow)) {
    throw new Error('목표 체중 형식이 맞지 않아요.');
  }
  if (typeof s.kLow !== 'number' || typeof s.kHigh !== 'number' || s.kLow < 0 || s.kHigh <= s.kLow) {
    throw new Error('칼륨 기준값 형식이 맞지 않아요.');
  }
  if (!Array.isArray(s.timings) || s.timings.some((t) => typeof t !== 'string')) throw new Error('측정 시점 형식이 맞지 않아요.');
  const t = parseTimings(s.timings.join(','));
  if (t.length !== s.timings.length) throw new Error('측정 시점 형식이 맞지 않아요.');
  return true;
}

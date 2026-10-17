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

// 100g(또는 100ml) 기준 값을 실제 먹은 양으로 환산. 값이 없으면 null 그대로 둔다.
export function scale(per100, amount) {
  if (per100 === null || per100 === undefined) return null;
  return (per100 * amount) / 100;
}

// "한 그릇 = N g" 설정으로 그릇 수를 그램으로 바꾼다.
export function servingsToAmount(servings, gramsPerServing) {
  return servings * gramsPerServing;
}

export function mealNutrients(meal) {
  return {
    kcal: scale(meal.per100.kcal, meal.amount),
    protein: scale(meal.per100.protein, meal.amount),
    potassium: scale(meal.per100.potassium, meal.amount),
  };
}

// 하루 합계. 칼륨은 값이 있는 음식만 더하고, 값이 없는 음식 수를 따로 센다.
export function dayTotals(meals, date) {
  const t = { count: 0, kcal: 0, protein: 0, potassiumKnown: 0, potassiumMissing: 0 };
  for (const m of meals) {
    if (m.date !== date) continue;
    const n = mealNutrients(m);
    t.count += 1;
    t.kcal += n.kcal ?? 0;
    t.protein += n.protein ?? 0;
    if (n.potassium === null) t.potassiumMissing += 1;
    else t.potassiumKnown += n.potassium;
  }
  return t;
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

export const POTASSIUM_LABEL = { low: '적음', mid: '보통', high: '많음', unknown: '칼륨 정보 없음' };

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
    if (typeof m.date !== 'string' || typeof m.amount !== 'number' || !m.per100) {
      throw new Error('식사 기록 형식이 맞지 않아요.');
    }
  }
  for (const w of obj.weights) {
    if (typeof w.date !== 'string' || typeof w.kg !== 'number') {
      throw new Error('체중 기록 형식이 맞지 않아요.');
    }
  }
  return true;
}

// 캐릭터 키우기: 성장 단계, 오늘 먹은 횟수, 보상, 칼륨 주의 단어. 화면과 상관없는 계산만 둔다.
import { addDays } from './calc.js';

export const STEP_KG = 0.5;   // 처음 몸무게에서 이만큼 늘 때마다 한 단계

export const PETS = {
  bunny: '토끼',
  chick: '병아리',
  bear: '곰',
  cat: '고양이',
};

// 이름을 비워 두면 쓰는 동물별 기본 이름
export const DEFAULT_NAMES = {
  bunny: '몽실',
  chick: '보리',
  bear: '도토리',
  cat: '나비',
};

// 친구 이름: 지어 준 이름이 없으면 동물별 기본 이름
export function petName(grow) {
  const n = String(grow?.name ?? '').trim();
  return n || DEFAULT_NAMES[grow?.pet] || '친구';
}

export function parsePetName(text) {
  const n = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (n.length > 8) throw new Error('이름은 8글자 이하로 지어 주세요.');
  if (/[<>"&]/.test(n)) throw new Error('이름에는 < > " & 를 쓸 수 없어요.');
  return n;   // 빈 문자열이면 기본 이름을 쓴다
}

function hasBatchim(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0;
}
const isHangul = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };

// 부를 때 쓰는 이름: 받침이 있으면 '이'를 붙인다 (몽실 → 몽실이, 나비 → 나비)
export function callName(name) {
  const last = name.slice(-1);
  return last && hasBatchim(last) ? `${name}이` : name;
}

// 조사 붙이기. 한글 이름은 부르는 이름 뒤에(늘 모음으로 끝남), 한글이 아니면 (이)가 처럼 둘 다 적는다.
export function withJosa(name, josa) {
  const last = name.slice(-1);
  if (last && isHangul(last)) return callName(name) + josa;
  const pairs = { 가: '(이)가', 는: '(이)는', 랑: '(이)랑', 도: '도', 를: '(이)를', 와: '(이)와' };
  return name + (pairs[josa] ?? josa);
}

// 성장 모습: 단계가 쌓인 정도(목표까지의 비율)에 따라 바뀐다. 마지막 모습은 목표에 도착했을 때만.
export const FORMS = ['아기', '새싹', '목도리', '꽃', '꽃왕관'];

export function defaultGrow() {
  return {
    started: false,
    pet: null,
    name: '',         // 지어 준 이름 (비우면 기본 이름)
    mealsPerDay: 4,
    timing: null,     // 성장에 쓰는 몸무게 측정 시점
    startKg: null,
    startDate: null,
    cautionWords: [], // 칼륨 주의 음식 이름
    notes: [],        // 오늘 먹은 음식 {id, date, time, name}
  };
}

// 목표까지 필요한 단계 수 (예: 30kg → 38kg 이면 16단계)
export function totalLevels(startKg, goalKg) {
  if (startKg == null || goalKg == null || goalKg <= startKg) return 1;
  return Math.max(1, Math.ceil((goalKg - startKg) / STEP_KG - 1e-9));
}

// 몸무게 하나로 정한 단계. 목표에 닿아야만 마지막 단계(total).
export function levelFor(kg, startKg, goalKg) {
  const total = totalLevels(startKg, goalKg);
  if (goalKg != null && kg >= goalKg) return total;
  const lv = Math.floor((kg - startKg) / STEP_KG + 1e-9);
  return Math.max(0, Math.min(total - 1, lv));
}

const key = (w) => w.date + ' ' + (w.time || '');

// 성장 상태. 같은 측정 시점의 시작일 이후 몸무게만 쓰고, 그중 가장 높이 올라간 단계를 유지한다
// (몸무게가 줄어도 작아지지 않는다). 잘못 적은 기록을 지우면 그 기록으로 올라간 단계도 함께 빠진다.
export function growState(grow, weights, goalKg) {
  const total = totalLevels(grow.startKg, goalKg);
  const mine = weights
    .filter((w) => w.timing === grow.timing && w.date >= grow.startDate)
    .sort((a, b) => key(a).localeCompare(key(b)));
  let level = 0;
  for (const w of mine) level = Math.max(level, levelFor(w.kg, grow.startKg, goalKg));
  const latest = mine.at(-1) ?? null;
  const prev = mine.length > 1 ? mine.at(-2) : null;
  const final = level >= total && goalKg != null;
  const nextKg = final ? null : Math.min(goalKg ?? Infinity, grow.startKg + (level + 1) * STEP_KG);
  const ratio = level / total;
  return {
    level, total, final,
    form: final ? FORMS.length - 1 : Math.min(FORMS.length - 2, Math.floor(ratio * (FORMS.length - 1))),
    scale: 0.62 + 0.38 * Math.min(1, ratio),
    currentKg: latest ? latest.kg : grow.startKg,
    nextKg,
    toNext: nextKg == null || !latest ? null : Math.max(0, Math.round((nextKg - latest.kg) * 10) / 10),
    dropped: !!(latest && prev && latest.kg < prev.kg),
  };
}

// 오늘 적은 음식 수와 목표 횟수
export function todayProgress(notes, date, mealsPerDay) {
  const count = notes.filter((n) => n.date === date).length;
  return { count, goal: mealsPerDay, done: count >= mealsPerDay };
}

// 자주 적은 음식 (많이 적은 순, 같으면 최근에 적은 순)
export function frequentFoods(notes, limit = 6) {
  const m = new Map();
  for (const n of notes) {
    const name = n.name.trim();
    const cur = m.get(name) || { name, count: 0, last: '' };
    cur.count += 1;
    if (key(n) > cur.last) cur.last = key(n);
    m.set(name, cur);
  }
  return [...m.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((x) => x.name);
}

// 보상: 무엇이든 기록한 날마다 꽃 하나, 목표 횟수를 다 채운 날마다 하트 하나.
// 기록에서 다시 계산하므로 따로 저장하지 않는다.
export function rewards(notes, weights, mealsPerDay) {
  const days = new Set([...notes.map((n) => n.date), ...weights.map((w) => w.date)]);
  const perDay = new Map();
  for (const n of notes) perDay.set(n.date, (perDay.get(n.date) || 0) + 1);
  const hearts = [...perDay.values()].filter((c) => c >= mealsPerDay).length;
  return { flowers: days.size, hearts };
}

// 오늘을 포함해 연속으로 기록한 날 수 (부담을 주지 않도록 화면에서는 칭찬에만 쓴다)
export function recordStreak(notes, weights, today) {
  const days = new Set([...notes.map((n) => n.date), ...weights.map((w) => w.date)]);
  let n = 0;
  for (let d = today; days.has(d); d = addDays(d, -1)) n += 1;
  return n;
}

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, '');
}

// 칼륨 주의 단어: 쉼표로 나눈 입력을 정리 (빈 값·중복 제거)
export function parseCautionWords(text) {
  const out = [];
  for (const w of String(text).split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) {
    if (w.length > 20) throw new Error('주의 음식 이름은 20글자 이하로 써 주세요.');
    if (!out.some((x) => norm(x) === norm(w))) out.push(w);
  }
  if (out.length > 50) throw new Error('주의 음식은 50개까지 적을 수 있어요.');
  return out;
}

// 적은 음식 이름에 들어 있는 주의 단어들 (띄어쓰기·대소문자 무시)
export function cautionMatches(name, words) {
  const n = norm(name);
  return words.filter((w) => norm(w) && n.includes(norm(w)));
}

export function parseFoodName(text) {
  const name = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('드신 음식 이름을 적어 주세요.');
  if (name.length > 30) throw new Error('음식 이름은 30글자 이하로 적어 주세요.');
  return name;
}

// 백업 속 키우기 정보 검사. 형식이 틀리면 throw.
export function validateGrow(g) {
  if (g === undefined) return true;
  const bad = (msg) => { throw new Error(`키우기 정보 형식이 맞지 않아요 (${msg}).`); };
  if (typeof g !== 'object' || g === null || Array.isArray(g)) bad('전체');
  if (g.pet != null && !(g.pet in PETS)) bad('친구 종류');
  if (g.name !== undefined && (typeof g.name !== 'string' || g.name.length > 8)) bad('친구 이름');
  if (g.mealsPerDay !== undefined) parseMealsPerDay(g.mealsPerDay);
  if (g.startKg != null && !(typeof g.startKg === 'number' && g.startKg > 0)) bad('시작 몸무게');
  if (g.cautionWords !== undefined && (!Array.isArray(g.cautionWords) || g.cautionWords.some((w) => typeof w !== 'string'))) bad('주의 음식');
  if (g.notes !== undefined) {
    if (!Array.isArray(g.notes)) bad('음식 기록');
    for (const n of g.notes) if (typeof n?.date !== 'string' || typeof n?.name !== 'string') bad('음식 기록');
  }
  return true;
}

export function parseMealsPerDay(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('하루 횟수는 1~10번으로 정해 주세요.');
  return n;
}

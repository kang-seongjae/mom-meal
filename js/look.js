// 화면 꾸미기용 도우미. 음식 이모지와 목표 진행 막대 값.
// 영양 계산·저장과는 상관없다 (calc.js 는 건드리지 않는다).
import { latestWeight, round1 } from './calc.js';

// 이름에 들어 있는 낱말로 먼저 고른다 (예: '달걀찜' → 🥚, '가래떡' → 🍡).
// 오래된 폰에서도 보이도록 널리 쓰이는 이모지만 쓴다.
const BY_NAME = [
  [['달걀', '계란', '메추리알'], '🥚'],
  [['떡'], '🍡'],
  [['죽', '스프', '수프'], '🥣'],
  [['김밥', '주먹밥', '초밥'], '🍙'],
  [['국수', '라면', '우동', '냉면', '칼국수', '파스타', '스파게티', '짜장', '짬뽕'], '🍜'],
  [['밥', '쌀'], '🍚'],
  [['우유', '두유', '요구르트', '요거트', '라떼', '음료', '셰이크'], '🥛'],
  [['주스', '에이드'], '🧃'],
  [['커피', '녹차', '홍차', '보리차', '유자차', '대추차', '생강차'], '🍵'],
  [['만두'], '🥟'],
  [['피자'], '🍕'],
  [['햄버거', '버거'], '🍔'],
  [['샌드위치', '토스트', '빵', '베이글', '머핀'], '🍞'],
  [['케이크', '쿠키', '과자', '비스킷'], '🍪'],
  [['아이스크림', '빙수'], '🍨'],
  [['닭', '치킨'], '🍗'],
  [['생선', '고등어', '연어', '참치', '갈치', '조기', '꽁치', '명태', '코다리', '동태'], '🐟'],
  [['새우'], '🍤'],
  [['고기', '불고기', '갈비', '소고기', '돼지', '삼겹', '제육', '장조림', '오리'], '🍖'],
  [['두부'], '🍲'],
  [['국', '탕', '찌개', '전골'], '🍲'],
  [['감자'], '🥔'],
  [['고구마'], '🍠'],
  [['옥수수'], '🌽'],
  [['바나나'], '🍌'],
  [['사과'], '🍎'],
  [['딸기'], '🍓'],
  [['포도'], '🍇'],
  [['수박'], '🍉'],
  [['귤', '오렌지'], '🍊'],
  [['김치', '나물', '시금치', '배추'], '🥬'],
  [['샐러드', '무침'], '🥗'],
  [['부침', '빈대떡', '파전', '김치전'], '🥞'],
];

// 이름으로 못 고르면 식약처 자료의 분류로 고른다.
const BY_CATEGORY = {
  '밥류': '🍚', '죽 및 스프류': '🥣', '국 및 탕류': '🍲', '찌개 및 전골류': '🍲', '찜류': '🍲', '조림류': '🍲',
  '면 및 만두류': '🍜', '빵 및 과자류': '🍞', '음료 및 차류': '🥛', '유제품류 및 빙과류': '🥛',
  '구이류': '🍖', '튀김류': '🍤', '볶음류': '🍳', '나물·숙채류': '🥬', '생채·무침류': '🥗', '김치류': '🥬',
  '전·적 및 부침류': '🥞', '장아찌·절임류': '🥬',
};

export function foodEmoji(food) {
  if (!food) return '🍽️';
  if (food.custom === 'recipe') return '🍳';
  const name = String(food.name || '');
  for (const [words, emoji] of BY_NAME) {
    if (words.some((w) => name.includes(w))) return emoji;
  }
  if (food.custom === 'label') return food.unit === 'ml' ? '🧃' : '🏷️';
  return BY_CATEGORY[food.category] || '🍽️';
}

// 목표 진행: 같은 측정 시점의 첫 기록에서 지금까지 목표(하한)를 향해 얼마나 왔는지.
// 목표가 없으면 null. percent 는 0~100.
export function goalProgress(weights, goalLow) {
  const now = latestWeight(weights);
  if (!now || goalLow == null) return null;
  const key = (w) => w.date + ' ' + (w.time || '');
  const same = weights.filter((w) => w.timing === now.timing).sort((a, b) => key(a).localeCompare(key(b)));
  const start = same[0];
  const gained = round1(now.kg - start.kg);
  let percent;
  if (now.kg >= goalLow) percent = 100;
  else if (start.kg >= goalLow) percent = 0;
  else percent = Math.max(0, Math.min(100, Math.round(((now.kg - start.kg) / (goalLow - start.kg)) * 100)));
  return { startKg: start.kg, startDate: start.date, currentKg: now.kg, goalKg: goalLow, gained, percent, timing: now.timing };
}

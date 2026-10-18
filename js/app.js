import {
  localDate, addDays, latestWeight, round1, goalText, parseGoal, parseTimings,
} from './calc.js';
import { load, save, newId, exportJson, exportSettingsJson, readBackupFile } from './store.js';
import { renderWeightChart } from './chart.js';
import {
  PETS, FORMS, DEFAULT_NAMES, petName, parsePetName, withJosa, callName, growState, todayProgress, frequentFoods, rewards, recordStreak,
  parseCautionWords, cautionMatches, parseFoodName, parseMealsPerDay,
} from './grow.js';
import { petSvg } from './pet.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

let state = load();
let chartTiming = null;
let weightEditing = false;
let cautionNote = '';     // 방금 적은 음식이 칼륨 주의 음식이면 보여 줄 안내

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const today = () => localDate();
const nowTime = () => new Date().toTimeString().slice(0, 5);
const emoji = (e) => `<span class="emo" aria-hidden="true">${e}</span>`;
const g = () => state.grow;

function persist() {
  save(state);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// 친구와 함께 잠깐 뜨는 축하 화면
function celebrate(title, sub = '', form = null) {
  const gs = growNow();
  const c = $('#celebrate');
  c.innerHTML = `${petSvg({ kind: g().pet, form: form ?? gs.form, scale: 1, mood: 'happy', size: 150, name: petName(g()) })}
    <span class="celebrate-title">${esc(title)}</span>${sub ? `<span class="celebrate-sub">${esc(sub)}</span>` : ''}`;
  c.hidden = false;
  c.classList.remove('pop');
  void c.offsetWidth; // 다시 떠도 움직임이 처음부터 나오도록
  c.classList.add('pop');
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => { c.hidden = true; }, 2600);
}

function goalKg() {
  return state.settings.goalLow;
}

function growNow() {
  return growState(g(), state.weights, goalKg());
}

function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}요일`;
}

function stepper(id, value, step, unit, label) {
  return `<div class="stepper">
    <button class="step" data-step="${id}" data-d="${-step}" aria-label="${label} ${step} 빼기">−</button>
    <label class="kg-input"><input id="${id}" type="number" inputmode="decimal" step="${step}" value="${value ?? ''}" placeholder="0" aria-label="${label}"><span>${unit}</span></label>
    <button class="step" data-step="${id}" data-d="${step}" aria-label="${label} ${step} 더하기">+</button>
  </div>`;
}

function bindSteppers(root = view) {
  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const input = $(`#${b.dataset.step}`, root);
    if (input.value === '') return input.focus(); // 처음에는 숫자를 직접 입력
    const d = Number(b.dataset.d);
    const v = Number(input.value) + d;
    input.value = Number.isInteger(d) ? String(Math.round(v)) : round1(v).toFixed(1);
  }));
}

// ───────── 처음 시작: 하루 횟수 → 친구 고르기 → 몸무게와 목표 ─────────
let startStep = 1;
let startDraft = null;

function renderStart() {
  document.body.classList.add('onboarding');
  if (!startDraft) {
    const last = latestWeight(state.weights);
    startDraft = {
      mealsPerDay: g().mealsPerDay || 4,
      pet: g().pet,
      name: g().name || '',
      kg: last ? last.kg : '',
      timing: last && state.settings.timings.includes(last.timing) ? last.timing : state.settings.timings[0],
      goal: state.settings.goalLow ?? '',
    };
  }
  const d = startDraft;
  const dots = [1, 2, 3, 4].map((i) => `<span class="dot ${i === startStep ? 'on' : ''}" aria-hidden="true"></span>`).join('');
  let body;
  if (startStep === 1) {
    body = `
      <h1>${emoji('🍚')} 하루에 몇 번 드실까요?</h1>
      <p class="lead">작은 간식도 한 번으로 세요. 적을 때마다 칸이 하나씩 채워져요.</p>
      <section class="card card-butter">
        ${stepper('s-meals', d.mealsPerDay, 1, '번', '하루 횟수')}
        <div class="slots big" aria-hidden="true">${Array.from({ length: Math.min(10, Number(d.mealsPerDay) || 0) }, () => '<span class="slot"></span>').join('')}</div>
      </section>
      <button class="btn btn-primary" id="s-next">다음</button>
      <label class="btn btn-secondary file-btn">다른 폰의 백업 불러오기<input id="import-start" type="file" accept="application/json,.json" hidden></label>`;
  } else if (startStep === 2) {
    body = `
      <h1>${emoji('🐣')} 함께 자랄 친구를 골라 주세요</h1>
      <p class="lead">몸무게가 늘면 친구도 함께 자라요.</p>
      <div class="pet-pick" role="radiogroup" aria-label="친구 고르기">
        ${Object.entries(PETS).map(([k, name]) => `<button class="pet-option ${d.pet === k ? 'on' : ''}" role="radio" aria-checked="${d.pet === k}" data-pet="${k}">
          ${petSvg({ kind: k, form: 0, scale: 1, size: 120 })}<span>${name}</span></button>`).join('')}
      </div>
      <button class="btn btn-primary" id="s-next" ${d.pet ? '' : 'disabled'}>다음</button>
      <button class="btn btn-secondary" id="s-back">이전</button>`;
  } else if (startStep === 3) {
    const def = DEFAULT_NAMES[d.pet];
    body = `
      <h1>${emoji('🏷️')} 이름을 지어 주세요</h1>
      <p class="lead">${esc(PETS[d.pet])} 친구를 뭐라고 부를까요?</p>
      <section class="card card-peach name-card">
        <div class="pet-stage">${petSvg({ kind: d.pet, form: 0, scale: 1, size: 150, name: d.name || def })}</div>
        <label class="field">친구 이름<input id="s-name" class="text-input" maxlength="8" value="${esc(d.name)}" placeholder="${esc(def)}" autocomplete="off"></label>
        <p class="small muted">비워 두면 "${esc(callName(def))}"라고 불러요. 나중에 설정에서 바꿀 수 있어요.</p>
      </section>
      <button class="btn btn-primary" id="s-next">다음</button>
      <button class="btn btn-secondary" id="s-back">이전</button>`;
  } else {
    body = `
      <h1>${emoji('⚖️')} 몸무게를 알려 주세요</h1>
      <section class="card card-mint">
        <p class="label">지금 몸무게</p>
        ${stepper('s-kg', d.kg, 0.1, 'kg', '지금 몸무게')}
        <p class="label">언제 잰 몸무게로 친구를 키울까요?</p>
        <div class="chips" role="group" aria-label="성장에 쓰는 측정 시점">
          ${state.settings.timings.map((t) => `<button class="chip ${t === d.timing ? 'on' : ''}" data-timing="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <p class="small muted">늘 같은 때 잰 몸무게로만 자라요. 다른 때 잰 몸무게도 기록은 돼요.</p>
      </section>
      <section class="card card-peach">
        <p class="label">목표 몸무게</p>
        ${stepper('s-goal', d.goal, 0.5, 'kg', '목표 몸무게')}
        <p class="small muted">0.5kg 늘 때마다 친구가 한 단계씩 자라고, 목표에 도착하면 마지막 모습이 돼요.</p>
      </section>
      <button class="btn btn-primary" id="s-done">친구 만나기</button>
      <button class="btn btn-secondary" id="s-back">이전</button>`;
  }
  view.innerHTML = `<div class="start-dots" aria-label="${startStep} / 4 단계">${dots}</div>${body}`;
  bindSteppers();

  const meals = $('#s-meals');
  meals?.addEventListener('input', () => { d.mealsPerDay = meals.value; });
  view.querySelectorAll('[data-step="s-meals"]').forEach((b) => b.addEventListener('click', () => {
    const v = Math.max(1, Math.min(10, Number(meals.value) || 1));
    meals.value = v;
    d.mealsPerDay = v;
    renderStart();
  }));
  view.querySelectorAll('[data-pet]').forEach((b) => b.addEventListener('click', () => {
    d.pet = b.dataset.pet;
    renderStart();
  }));
  view.querySelectorAll('[data-timing]').forEach((b) => b.addEventListener('click', () => {
    d.timing = b.dataset.timing;
    view.querySelectorAll('[data-timing]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#s-name')?.addEventListener('input', (e) => { d.name = e.target.value; });
  $('#s-kg')?.addEventListener('input', (e) => { d.kg = e.target.value; });
  $('#s-goal')?.addEventListener('input', (e) => { d.goal = e.target.value; });
  $('#s-back')?.addEventListener('click', () => { startStep -= 1; renderStart(); });
  $('#import-start')?.addEventListener('change', importFromInput);
  $('#s-next')?.addEventListener('click', () => {
    if (startStep === 1) {
      try { d.mealsPerDay = parseMealsPerDay(meals.value); } catch (err) { return toast(err.message); }
    }
    if (startStep === 2 && !d.pet) return toast('친구를 하나 골라 주세요.');
    if (startStep === 3) {
      try { d.name = parsePetName($('#s-name').value); } catch (err) { return toast(err.message); }
    }
    startStep += 1;
    renderStart();
  });
  $('#s-done')?.addEventListener('click', () => {
    d.kg = $('#s-kg').value;
    d.goal = $('#s-goal').value;
    const kg = round1(Number(d.kg));
    if (!(kg >= 10 && kg <= 150)) return toast('지금 몸무게를 확인해 주세요.');
    let goal;
    try { goal = parseGoal(d.goal, ''); } catch (err) { return toast(err.message); }
    if (goal.goalLow === null) return toast('목표 몸무게를 적어 주세요.');
    if (goal.goalLow <= kg) return toast('목표 몸무게는 지금보다 무겁게 적어 주세요.');

    // 같은 때 잰 마지막 기록과 다르면 오늘 몸무게로 남긴다 (기존 체중 기록은 그대로 둔다)
    const lastSame = latestWeight(state.weights.filter((w) => w.timing === d.timing));
    if (!lastSame || lastSame.kg !== kg) {
      state.weights.push({ id: newId(), date: today(), time: nowTime(), kg, timing: d.timing });
    }
    state.settings = { ...state.settings, ...goal };
    state.grow = {
      ...g(), started: true, pet: d.pet, name: d.name, mealsPerDay: Number(d.mealsPerDay), timing: d.timing,
      startKg: kg, startDate: today(),
    };
    persist();
    startDraft = null;
    startStep = 1;
    document.body.classList.remove('onboarding');
    history.replaceState(null, '', '#today');  // 이미 #today 로 열려 있어도 화면이 바뀌도록 직접 그린다
    route();
    celebrate(`${withJosa(petName(g()), '가')} 태어났어요!`, '앞으로 잘 부탁해요', 0);
  });
}

// ───────── 오늘 (첫 화면) ─────────
function petMessage(gs, prog) {
  const nm = petName(g());
  if (gs.final) return `목표에 도착했어요! ${withJosa(nm, '도')} 꽃왕관을 썼어요. 정말 고마워요.`;
  if (gs.dropped && latestGrowWeight()?.date === today()) {
    return `조금 줄었어도 괜찮아요. ${withJosa(nm, '는')} 그대로 자라 있어요. 내일 또 같이 해요!`;
  }
  if (prog.done) return `${withJosa(nm, '가')} 배불러서 기뻐해요! 오늘 ${prog.goal}번 다 드셨어요.`;
  if (prog.count === 0) return `${withJosa(nm, '가')} 첫 끼니를 기다리고 있어요. 천천히 드셔도 괜찮아요.`;
  return `${prog.count}번 드셨어요! ${withJosa(nm, '랑')} ${prog.goal - prog.count}번 더 같이 해요.`;
}

function latestGrowWeight() {
  return latestWeight(state.weights.filter((w) => w.timing === g().timing && w.date >= g().startDate));
}

function renderToday() {
  const gs = growNow();
  const prog = todayProgress(g().notes, today(), g().mealsPerDay);
  const rw = rewards(g().notes, state.weights, g().mealsPerDay);
  // 말풍선과 표정을 맞춘다: 몸무게가 줄어든 날은 응원 표정이 먼저
  const droppedToday = !gs.final && gs.dropped && latestGrowWeight()?.date === today();
  const mood = droppedToday ? 'cheer' : prog.done || gs.final ? 'happy' : 'normal';
  const notes = g().notes.filter((n) => n.date === today());
  const quick = frequentFoods(g().notes);
  const todayWeights = state.weights.filter((w) => w.date === today());
  const tw = latestWeight(todayWeights);
  const last = latestWeight(state.weights);
  const growLine = gs.final ? '마지막 모습이에요!'
    : gs.toNext === 0 ? '곧 자랄 거예요!'
      : gs.toNext != null ? `다음까지 ${gs.toNext}kg` : '';
  const extra = Math.max(0, prog.count - prog.goal);

  view.innerHTML = `
    <header class="top">
      <p class="date">${dateLabel(today())}</p>
      <p class="rewards" aria-label="모은 꽃 ${rw.flowers}개, 하트 ${rw.hearts}개">${emoji('🌸')} ${rw.flowers} &nbsp;${emoji('❤️')} ${rw.hearts}</p>
    </header>

    <section class="card card-peach pet-card">
      <p class="bubble">${esc(petMessage(gs, prog))}</p>
      <div class="pet-stage">${petSvg({ kind: g().pet, form: gs.form, scale: gs.scale, mood, size: 200, crop: true, name: petName(g()) })}</div>
      <p class="pet-name"><b class="pet-call">${esc(petName(g()))}</b> · ${esc(PETS[g().pet])} · ${FORMS[gs.form]} 모습</p>
      <p class="pet-level">${gs.level}/${gs.total}단계${growLine ? ` · ${growLine}` : ''}</p>
    </section>

    <section class="card card-butter">
      <h2>${emoji('🍚')} 오늘 먹은 음식</h2>
      <div class="slots" role="img" aria-label="오늘 ${prog.goal}번 중 ${Math.min(prog.count, prog.goal)}번 먹었어요">
        ${Array.from({ length: prog.goal }, (_, i) => `<span class="slot ${i < prog.count ? 'on' : ''}">${i < prog.count ? '✓' : ''}</span>`).join('')}
        ${extra ? `<span class="slot-extra">+${extra}</span>` : ''}
      </div>
      <form id="note-form" class="note-form">
        <input id="note" class="text-input" type="text" maxlength="30" placeholder="드신 음식 이름" autocomplete="off" aria-label="드신 음식 이름">
        <button class="btn btn-primary" type="submit">적기</button>
      </form>
      ${cautionNote ? `<p class="knote k-high" role="status">${esc(cautionNote)}</p>` : ''}
      ${quick.length ? `<p class="label">자주 드신 음식</p>
        <div class="quick">${quick.map((q) => `<button class="chip quick-btn" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
      ${notes.length ? `<ul class="list">${notes.map((n) => {
        const warn = cautionMatches(n.name, g().cautionWords).length;
        return `<li><div class="li-main"><b>${esc(n.name)}</b><span>${esc(n.time || '')}</span>
          ${warn ? '<span class="kbadge k-high">칼륨 주의</span>' : ''}</div>
          <button class="btn-text" data-del-note="${n.id}">지우기</button></li>`;
      }).join('')}</ul>` : '<p class="muted">아직 적은 음식이 없어요. 드신 걸 하나씩 적어 볼까요?</p>'}
    </section>

    <section class="card card-mint">
      <h2>${emoji('⚖️')} 오늘 몸무게</h2>
      ${tw && !weightEditing ? `
        <p class="hero"><b>${tw.kg}</b><span>kg</span></p>
        <p class="muted">${esc(tw.timing)}에 쟀어요</p>
        <button class="btn btn-secondary" id="w-again">다시 적기</button>` : `
        ${stepper('w-kg', last ? last.kg : '', 0.1, 'kg', '오늘 몸무게')}
        <div class="chips" role="group" aria-label="측정 시점">
          ${state.settings.timings.map((t) => `<button class="chip ${t === g().timing ? 'on' : ''}" data-wtiming="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <button class="btn btn-primary" id="w-save">몸무게 저장</button>`}
      <p class="small muted">친구는 "${esc(g().timing)}" 몸무게로 자라요.</p>
    </section>`;

  bindSteppers();
  $('#note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    addNote($('#note').value);
  });
  view.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => addNote(b.dataset.quick)));
  view.querySelectorAll('[data-del-note]').forEach((b) => b.addEventListener('click', () => {
    const n = g().notes.find((x) => x.id === b.dataset.delNote);
    if (n && confirm(`"${n.name}" 기록을 지울까요?`)) {
      g().notes = g().notes.filter((x) => x.id !== n.id);
      cautionNote = '';
      persist();
      renderToday();
    }
  }));
  $('#w-again')?.addEventListener('click', () => { weightEditing = true; renderToday(); });
  let timing = g().timing;
  view.querySelectorAll('[data-wtiming]').forEach((b) => b.addEventListener('click', () => {
    timing = b.dataset.wtiming;
    view.querySelectorAll('[data-wtiming]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#w-save')?.addEventListener('click', () => saveWeight($('#w-kg').value, timing));
}

function addNote(text) {
  let name;
  try { name = parseFoodName(text); } catch (err) { return toast(err.message); }
  const before = todayProgress(g().notes, today(), g().mealsPerDay);
  g().notes.push({ id: newId(), date: today(), time: nowTime(), name });
  persist();
  const after = todayProgress(g().notes, today(), g().mealsPerDay);
  const words = cautionMatches(name, g().cautionWords);
  // 칼륨 주의: 부드럽게 알려 주기만 하고 기록은 막지 않는다
  cautionNote = words.length
    ? `"${words.join(', ')}"은(는) 칼륨 주의 음식으로 적어 두신 거예요. 기록은 그대로 했어요.`
    : '';
  renderToday();
  if (!before.done && after.done) {
    celebrate(`${withJosa(petName(g()), '가')} 배불러서 기뻐해요!`, `오늘 ${after.goal}번 다 드셨어요. 정말 잘하셨어요!`);
  } else {
    toast(`잘 드셨어요! (${Math.min(after.count, after.goal)}/${after.goal})`);
  }
}

function saveWeight(value, timing) {
  const kg = round1(Number(value));
  if (!(kg >= 10 && kg <= 150)) return toast('몸무게 숫자를 다시 확인해 주세요.');
  const before = growNow();
  state.weights.push({ id: newId(), date: today(), time: nowTime(), kg, timing });
  persist();
  weightEditing = false;
  const after = growNow();
  renderToday();
  if (after.final && !before.final) {
    celebrate('목표에 도착했어요!', `${withJosa(petName(g()), '가')} 꽃왕관을 썼어요. 정말 고마워요!`);
  } else if (after.level > before.level) {
    celebrate(`${withJosa(petName(g()), '가')} 쑥 자랐어요!`, `${after.level}단계 · ${FORMS[after.form]} 모습`);
  } else if (timing === g().timing && after.dropped) {
    toast(`괜찮아요, ${withJosa(petName(g()), '랑')} 내일 또 같이 해요 💛`);
  } else {
    toast('몸무게를 적어 주셔서 고마워요!');
  }
}

// ───────── 기록: 체중 그래프, 지난 기록 ─────────
function renderRecords() {
  const timings = [...new Set(state.weights.map((x) => x.timing))];
  if (!timings.includes(chartTiming)) chartTiming = timings.includes(g().timing) ? g().timing : timings[0] ?? null;
  const recent = [...state.weights].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 10);
  const rw = rewards(g().notes, state.weights, g().mealsPerDay);
  const streak = recordStreak(g().notes, state.weights, today());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(today(), -i);
    // 예전 화면에서 적은 식사 기록도 이름으로 함께 보여 준다
    const names = [...g().notes.filter((n) => n.date === d).map((n) => n.name),
      ...state.meals.filter((m) => m.date === d).map((m) => m.name)];
    if (names.length) days.push({ d, names, count: g().notes.filter((n) => n.date === d).length });
  }

  view.innerHTML = `
    <h1>${emoji('📅')} 기록</h1>
    <section class="card card-sky">
      <h2>${emoji('📈')} 몸무게 그래프</h2>
      ${timings.length > 1 ? `<div class="chips small" role="group" aria-label="그래프 측정 시점">
        ${timings.map((x) => `<button class="chip ${x === chartTiming ? 'on' : ''}" data-ctiming="${esc(x)}">${esc(x)}</button>`).join('')}
      </div>` : ''}
      <div id="chart" class="chart-box"></div>
    </section>
    <section class="card card-cream">
      <h2>${emoji('🎁')} 모은 선물</h2>
      <p>${emoji('🌸')} 꽃 <b>${rw.flowers}</b>송이 · ${emoji('❤️')} 하트 <b>${rw.hearts}</b>개</p>
      ${streak >= 2 ? `<p>${streak}일째 함께 기록하고 있어요!</p>` : ''}
      <p class="small muted">기록한 날마다 꽃 한 송이, 하루 ${g().mealsPerDay}번을 다 채운 날마다 하트 하나를 모아요.</p>
    </section>
    <section class="card card-butter">
      <h2>${emoji('🍚')} 지난 7일 먹은 음식</h2>
      ${days.length ? `<ul class="list">${days.map((x) => `<li><div class="li-main"><b>${dateLabel(x.d)}</b>
        <span>${esc(x.names.join(', '))}</span></div><span class="day-count">${x.count}/${g().mealsPerDay}</span></li>`).join('')}</ul>`
        : '<p class="muted">아직 기록이 없어요.</p>'}
    </section>
    <section class="card card-mint">
      <h2>${emoji('⚖️')} 몸무게 기록</h2>
      ${recent.length ? `<ul class="list">${recent.map((w) => `<li><div class="li-main"><b>${w.kg}kg</b>
        <span>${dateLabel(w.date)} · ${esc(w.timing)}</span></div>
        <button class="btn-text" data-del-weight="${w.id}">지우기</button></li>`).join('')}</ul>` : '<p class="muted">아직 기록이 없어요.</p>'}
      <p class="small muted">잘못 적은 몸무게를 지우면, 그 기록으로 자란 단계도 함께 돌아가요.</p>
    </section>`;

  view.querySelectorAll('[data-ctiming]').forEach((b) => b.addEventListener('click', () => {
    chartTiming = b.dataset.ctiming;
    renderRecords();
  }));
  view.querySelectorAll('[data-del-weight]').forEach((b) => b.addEventListener('click', () => {
    const w = state.weights.find((x) => x.id === b.dataset.delWeight);
    if (w && confirm(`${w.kg}kg 기록을 지울까요?`)) {
      state.weights = state.weights.filter((x) => x.id !== w.id);
      persist();
      renderRecords();
    }
  }));
  const byDate = new Map();
  const sorted = [...state.weights].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  for (const w of sorted) if (w.timing === chartTiming) byDate.set(w.date, w.kg);
  renderWeightChart($('#chart'), [...byDate].map(([date, kg]) => ({ date, kg })), state.settings.goalLow, state.settings.goalHigh);
}

// ───────── 설정 (보호자용) ─────────
function renderSettings() {
  const s = state.settings;
  view.innerHTML = `
    <h1>${emoji('⚙️')} 설정</h1>
    <p class="muted">보호자님이 정해 두시는 곳이에요.</p>

    <section class="card card-peach">
      <h2>함께 자라는 친구</h2>
      <div class="pet-pick small" role="radiogroup" aria-label="친구 바꾸기">
        ${Object.entries(PETS).map(([k, name]) => `<button class="pet-option ${g().pet === k ? 'on' : ''}" role="radio" aria-checked="${g().pet === k}" data-pet="${k}">
          ${petSvg({ kind: k, form: growNow().form, scale: 1, size: 90 })}<span>${name}</span></button>`).join('')}
      </div>
      <p class="small muted">친구를 바꿔도 자란 단계는 그대로예요.</p>
      <label class="field">친구 이름<input id="set-name" class="text-input" maxlength="8" value="${esc(g().name || '')}" placeholder="${esc(DEFAULT_NAMES[g().pet] ?? '')}" autocomplete="off"></label>
      <p class="small muted">비워 두면 기본 이름(토끼 몽실, 병아리 보리, 곰 도토리, 고양이 나비)으로 불러요.</p>
    </section>

    <section class="card card-butter">
      <h2>하루에 먹을 횟수</h2>
      ${stepper('set-meals', g().mealsPerDay, 1, '번', '하루 횟수')}
    </section>

    <section class="card card-mint">
      <h2>몸무게</h2>
      <p class="label">목표 몸무게</p>
      <div class="pair">
        <label><input id="goalLow" type="number" inputmode="decimal" step="0.5" value="${s.goalLow ?? ''}"> kg</label>
        <span>~</span>
        <label><input id="goalHigh" type="number" inputmode="decimal" step="0.5" value="${s.goalHigh ?? ''}"> kg</label>
      </div>
      <p class="small muted">친구는 앞의 값(${s.goalLow ?? '-'}kg)에 도착하면 마지막 모습이 돼요. 처음 몸무게: ${g().startKg ?? '-'}kg (${g().startDate ?? '-'})</p>
      <p class="label">측정 시점 버튼</p>
      <input id="timings" class="text-input" type="text" value="${esc(s.timings.join(', '))}">
      <p class="small muted">쉼표로 나눠 6개까지 쓸 수 있어요.</p>
      <p class="label">친구를 키우는 몸무게</p>
      <div class="chips" role="group" aria-label="성장에 쓰는 측정 시점">
        ${s.timings.map((t) => `<button class="chip ${t === g().timing ? 'on' : ''}" data-gtiming="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      <p class="small muted">이때 잰 몸무게로만 자라요. 바꾸면 그 시점 기록으로 다시 계산해요.</p>
    </section>

    <section class="card card-cream">
      <h2>칼륨 주의 음식</h2>
      <p class="notice">⚠ 병원 기준으로 확인하세요.</p>
      <p class="small">여기 적은 이름이 들어간 음식을 적으면 부드럽게 알려 드려요. 기록은 막지 않아요.</p>
      <textarea id="caution" class="text-input" rows="3" placeholder="쉼표로 나눠 적어 주세요">${esc(g().cautionWords.join(', '))}</textarea>
    </section>
    <button class="btn btn-primary" id="save-settings">설정 저장</button>

    <section class="card card-cream">
      <h2>백업</h2>
      <p class="small muted">기록은 이 폰의 브라우저에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 내보내 두세요.</p>
      <button class="btn btn-secondary" id="export">전체 백업 내보내기</button>
      <button class="btn btn-secondary" id="export-settings">설정만 내보내기</button>
      <p class="small muted">설정만 내보내기: 하루 횟수, 친구, 칼륨 주의 음식, 목표 몸무게, 측정 시점이 들어가고 음식·몸무게 기록은 빠져요.</p>
      <label class="btn btn-secondary file-btn">백업 불러오기<input id="import" type="file" accept="application/json,.json" hidden></label>
      <p class="small muted">전체 백업을 불러오면 이 폰의 기록이 백업으로 바뀌어요. 설정 파일을 불러오면 기록은 그대로 두고 설정만 합쳐요.</p>
    </section>

    <section class="card card-cream source">
      <p class="small muted">이 앱은 식사와 몸무게 기록을 돕는 도구이며 의학적 조언을 하지 않아요. 식사와 관련된 결정은 담당 의료진과 상의해 주세요.</p>
    </section>`;

  bindSteppers();
  let pet = g().pet;
  let growTiming = g().timing;
  view.querySelectorAll('[data-pet]').forEach((b) => b.addEventListener('click', () => {
    pet = b.dataset.pet;
    $('#set-name').placeholder = DEFAULT_NAMES[pet];
    view.querySelectorAll('[data-pet]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  }));
  view.querySelectorAll('[data-gtiming]').forEach((b) => b.addEventListener('click', () => {
    growTiming = b.dataset.gtiming;
    view.querySelectorAll('[data-gtiming]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#save-settings').addEventListener('click', () => {
    let next, mealsPerDay, cautionWords, timings, name;
    try {
      name = parsePetName($('#set-name').value);
      next = parseGoal($('#goalLow').value, $('#goalHigh').value);
      timings = parseTimings($('#timings').value);
      mealsPerDay = parseMealsPerDay($('#set-meals').value);
      cautionWords = parseCautionWords($('#caution').value);
    } catch (err) {
      return toast(err.message);
    }
    if (next.goalLow === null) return toast('목표 몸무게를 적어 주세요.');
    if (!timings.includes(growTiming)) growTiming = timings[0];
    state.settings = { ...state.settings, ...next, timings };
    state.grow = { ...g(), pet, name, mealsPerDay, cautionWords, timing: growTiming };
    persist();
    toast('설정을 저장했어요.');
    renderSettings();
  });

  const download = (text, filename) => {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#export').addEventListener('click', () => download(exportJson(state), `식사기록-백업-${today()}.json`));
  $('#export-settings').addEventListener('click', () => download(exportSettingsJson(state), `식사기록-설정-${today()}.json`));
  $('#import').addEventListener('change', importFromInput);
}

// 백업 불러오기 (설정 화면과 처음 시작 화면에서 함께 쓴다)
async function importFromInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const r = readBackupFile(await file.text(), state);
    if (r.kind === 'settings') {
      if (!confirm('설정 파일이에요. 음식·몸무게 기록은 그대로 두고 설정만 합칠까요?\n· 하루 횟수, 목표 몸무게, 측정 시점은 파일의 값으로 바뀌어요.\n· 칼륨 주의 음식은 없던 것만 더해요.')) return;
      state = r.state;
    } else {
      const next = r.state;
      if (!confirm(`전체 백업이에요. 몸무게 ${next.weights.length}건, 적은 음식 ${next.grow.notes.length}건을 불러올까요?\n지금 폰에 있는 기록은 이 백업으로 바뀌어요.`)) return;
      state = next;
    }
    persist();
    startDraft = null;
    startStep = 1;
    toast('불러왔어요.');
    route();
  } catch (err) {
    alert(err.message);
  } finally {
    e.target.value = '';
  }
}

// ───────── 화면 전환 ─────────
const routes = { start: renderStart, today: renderToday, records: renderRecords, settings: renderSettings };

function route() {
  let key = location.hash.slice(1).split('?')[0];
  if (!g().started) key = 'start';           // 친구를 만나기 전에는 처음 시작 화면
  else if (!routes[key] || key === 'start') key = 'today';
  if (key !== 'start') document.body.classList.remove('onboarding');
  if (key !== 'today') { weightEditing = false; cautionNote = ''; }
  routes[key]();
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${key}`));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}

import {
  localDate, mealNutrients, compareToday, potassiumStatus, POTASSIUM_LABEL,
  latestWeight, remainingToGoal, round1, cheerMessage, goalText, parseGoal, parseTimings,
  recipeNutrients, isRecordable, parseCountUnit, parseLabelFood,
} from './calc.js';
import { load, save, newId, exportJson, importJson } from './store.js';
import { loadFoods, getFood, getMeta, searchFoods, setCustomFoods, SOURCE_LABEL } from './foods.js';
import { renderWeightChart } from './chart.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

let state = load();
setCustomFoods(state.customFoods);
let foodsReady = false;
let chartTiming = null;
let lastQuery = '';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const kcalText = (v) => Math.round(v).toLocaleString('ko-KR');
const gText = (v) => round1(v).toLocaleString('ko-KR');
const orBlank = (v, f) => (v == null ? '입력 안 함' : f(v));
const today = () => localDate();
const nowTime = () => new Date().toTimeString().slice(0, 5);

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

// 자료에는 반찬도 100ml 기준인 것이 있어서, 단위가 아니라 음료인지로 정한다.
function servingWord(food) {
  return food.category === '음료 및 차류' ? '잔' : '그릇';
}

// "100g", "200ml", "1인분" — 영양 수치가 무엇 기준인지
function basisText(food) {
  if (food.custom === 'recipe') return '1인분';
  if (!(food.basis > 0)) return '기준량 미입력';
  return `${gText(food.basis)}${food.unit}`;
}

// 기록한 양 표시: "2개 (100g)", "1인분", "150g"
function amountText(unit, amount, label) {
  const base = unit === '인분' ? `${gText(amount)}인분` : `${gText(amount)}${unit}`;
  return label ? `${label} (${base})` : base;
}

function potassiumBadge(mg, partial) {
  const st = potassiumStatus(mg, partial, state.settings);
  const cls = st === 'partial-high' ? 'k-high' : st === 'partial' ? 'k-unknown' : `k-${st}`;
  const text = ['low', 'mid', 'high'].includes(st) ? `칼륨 ${POTASSIUM_LABEL[st]}` : POTASSIUM_LABEL[st];
  return `<span class="kbadge ${cls}">${text}</span>`;
}

// 양 고르기 창의 칼륨 안내. 기록은 막지 않는다.
function potassiumNote(n, food) {
  const st = potassiumStatus(n.potassium, n.potassiumPartial, state.settings);
  const mg = n.potassium == null ? '' : kcalText(n.potassium);
  if (st === 'unknown') {
    const why = food.custom === 'label' ? '라벨의 칼륨 값을 넣지 않았어요'
      : food.custom === 'recipe' ? '재료에 칼륨 값이 없어요' : '이 음식은 자료에 칼륨 값이 없어요';
    return `<p class="knote k-unknown">칼륨 정보 없음 (${why})</p>`;
  }
  if (st === 'partial') {
    return `<p class="knote k-unknown">칼륨 일부 정보 없음<br>칼륨 값이 없는 재료가 있어요. 값이 있는 재료만 더하면 약 ${mg}mg이에요.</p>`;
  }
  if (st === 'partial-high') {
    return `<p class="knote k-high">칼륨이 많은 편이에요 (값이 있는 재료만 약 ${mg}mg, 일부 정보 없음).<br>기록은 그대로 하실 수 있어요.</p>`;
  }
  if (st === 'high') {
    return `<p class="knote k-high">이 양에는 칼륨이 많은 편이에요 (약 ${mg}mg).<br>기록은 그대로 하실 수 있어요.</p>`;
  }
  return `<p class="knote k-${st}">칼륨 ${POTASSIUM_LABEL[st]} (약 ${mg}mg)</p>`;
}

function foodPer(food) {
  return { kcal: food.kcal, protein: food.protein, potassium: food.potassium, potassiumPartial: food.potassiumPartial };
}

// 직접 등록한 음식 저장 (있으면 바꾸고 없으면 추가)
function upsertCustom(obj) {
  const i = state.customFoods.findIndex((c) => c.code === obj.code);
  if (i >= 0) state.customFoods[i] = obj;
  else state.customFoods.push(obj);
  setCustomFoods(state.customFoods);
}

function removeCustom(code) {
  state.customFoods = state.customFoods.filter((c) => c.code !== code);
  state.favorites = state.favorites.filter((c) => c !== code);
  delete state.units[code];
  delete state.servings[code];
  setCustomFoods(state.customFoods);
}

function setFavorite(code, on) {
  const has = state.favorites.includes(code);
  if (on && !has) state.favorites.push(code);
  if (!on && has) state.favorites = state.favorites.filter((c) => c !== code);
}

// ───────── 홈 ─────────
function renderHome() {
  const d = new Date();
  const cmp = compareToday(state.meals, today());
  const w = latestWeight(state.weights);
  const goal = goalText(state.settings);
  const remain = w ? remainingToGoal(w.kg, state.settings.goalLow) : null;

  let weightHtml;
  if (!w) {
    weightHtml = `<p class="big-label">아직 체중 기록이 없어요</p>
      <a class="btn btn-secondary" href="#weight">체중 기록하기</a>`;
  } else {
    const [, wm, wd] = w.date.split('-').map(Number);
    weightHtml = `
      <p class="label">지금 체중 <span class="sub">(${wm}/${wd} ${esc(w.timing)})</span></p>
      <p class="hero"><b>${w.kg}</b><span>kg</span></p>
      <p class="goal-line">${!goal
        ? '<a href="#settings">설정에서 목표 체중을 입력해 주세요</a>'
        : remain > 0
          ? `목표 ${goal}까지 <b>${remain}kg</b> 남았어요`
          : `목표 ${goal}에 도착했어요!`}</p>`;
  }

  const timings = [...new Set(state.weights.map((x) => x.timing))];
  if (!timings.includes(chartTiming)) {
    const count = (t) => state.weights.filter((x) => x.timing === t).length;
    chartTiming = timings.sort((a, b) => count(b) - count(a))[0] || null;
  }

  const t = cmp.today;
  let compareHtml = '';
  if (cmp.yesterday || cmp.average) {
    const parts = [];
    if (cmp.yesterday) parts.push(`어제 ${kcalText(cmp.yesterday.kcal)}kcal`);
    if (cmp.average) parts.push(`최근 7일 평균 ${kcalText(cmp.average.kcal)}kcal`);
    compareHtml = `<p class="compare">${parts.join(' · ')}</p>`;
  }
  const praise = [];
  if (cmp.moreThanYesterday) praise.push(`어제보다 ${kcalText(t.kcal - cmp.yesterday.kcal)}kcal 더 드셨어요`);
  else if (cmp.moreThanAverage) praise.push(`평균보다 ${kcalText(t.kcal - cmp.average.kcal)}kcal 더 드셨어요`);
  if (cmp.proteinMoreThanYesterday) praise.push('단백질도 어제보다 많아요');
  else if (cmp.proteinMoreThanAverage) praise.push('단백질도 평균보다 많아요');

  view.innerHTML = `
    <header class="top">
      <p class="date">${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일</p>
      <a class="settings-link" href="#settings" aria-label="설정">설정</a>
    </header>
    <p class="cheer">${esc(cheerMessage(cmp))}</p>
    <section class="card">
      ${weightHtml}
      ${timings.length > 1 ? `<div class="chips small" role="group" aria-label="그래프 측정 시점">
        ${timings.map((x) => `<button class="chip ${x === chartTiming ? 'on' : ''}" data-timing="${esc(x)}">${esc(x)}</button>`).join('')}
      </div>` : ''}
      <div id="chart" class="chart-box"></div>
    </section>
    <section class="card">
      <p class="label">오늘 드신 양</p>
      <div class="totals">
        <div><b>${kcalText(t.kcal)}</b><span>kcal</span></div>
        <div><b>${gText(t.protein)}</b><span>g 단백질</span></div>
      </div>
      ${praise.length ? `<p class="praise">👏 ${praise.join(', ')}!</p>` : ''}
      ${compareHtml}
    </section>
    <a class="btn btn-primary" href="#meal">식사 기록하기</a>`;

  view.querySelectorAll('[data-timing]').forEach((b) => b.addEventListener('click', () => {
    chartTiming = b.dataset.timing;
    renderHome();
  }));
  drawChart();
}

function drawChart() {
  const box = $('#chart');
  if (!box) return;
  const byDate = new Map();
  const sorted = [...state.weights].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  for (const w of sorted) if (w.timing === chartTiming) byDate.set(w.date, w.kg); // 같은 날은 마지막 값
  const points = [...byDate].map(([date, kg]) => ({ date, kg }));
  renderWeightChart(box, points, state.settings.goalLow, state.settings.goalHigh);
}

// ───────── 식사 기록 ─────────
function resultItem(f, attr = 'data-code') {
  const info = isRecordable(f)
    ? `${esc(f.rest || f.origin)} · ${basisText(f)}당 ${kcalText(f.kcal)}kcal`
    : `${esc(f.origin)} · <span class="tag">수치 입력 필요</span>`;
  return `<li><button class="result" ${attr}="${esc(f.code)}">
    <b>${esc(f.name)}</b><span class="rest">${info}</span>
  </button></li>`;
}

function renderMeal() {
  const favs = state.favorites.map(getFood).filter(Boolean);
  const todays = state.meals.filter((m) => m.date === today());

  view.innerHTML = `
    <h1>식사 기록</h1>
    ${favs.length ? `<section>
      <h2>즐겨찾기</h2>
      <div class="fav-grid">${favs.map((f) => `<button class="fav" data-code="${esc(f.code)}">${esc(f.name)}</button>`).join('')}</div>
    </section>` : ''}
    <section>
      <h2>음식 찾기</h2>
      <input id="q" class="search" type="search" placeholder="음식 이름 (예: 죽, 계란)" autocomplete="off" value="${esc(lastQuery)}">
      <ul id="results" class="results"></ul>
    </section>
    <section>
      <h2>오늘 드신 음식</h2>
      ${todays.length ? `<ul class="list">${todays.map((m) => {
        const n = mealNutrients(m);
        return `<li>
          <div class="li-main"><b>${esc(m.name)}</b>
            <span>${esc(amountText(m.unit, m.amount, m.amountLabel))} · ${kcalText(n.kcal)}kcal · 단백질 ${gText(n.protein)}g</span>
            ${potassiumBadge(n.potassium, n.potassiumPartial)}</div>
          <button class="btn-text" data-del-meal="${m.id}">지우기</button>
        </li>`;
      }).join('')}</ul>` : '<p class="muted">아직 기록이 없어요.</p>'}
    </section>`;

  const q = $('#q');
  const results = $('#results');
  const doSearch = () => {
    lastQuery = q.value;
    if (!foodsReady) {
      results.innerHTML = '<li class="muted">음식 정보를 불러오는 중이에요…</li>';
      return;
    }
    const hits = searchFoods(q.value);
    results.innerHTML = q.value.trim() && !hits.length
      ? '<li class="muted">찾는 음식이 없어요. 다른 이름으로 찾아보세요.</li>'
      : hits.map((f) => resultItem(f)).join('');
  };
  q.addEventListener('input', doSearch);
  if (lastQuery) doSearch();

  view.addEventListener('click', onMealClick);
}

function onMealClick(e) {
  const pick = e.target.closest('[data-code]');
  if (pick && view.contains(pick)) return openAmountSheet(pick.dataset.code);
  const del = e.target.closest('[data-del-meal]');
  if (del) {
    const m = state.meals.find((x) => x.id === del.dataset.delMeal);
    if (m && confirm(`"${m.name}" 기록을 지울까요?`)) {
      state.meals = state.meals.filter((x) => x.id !== m.id);
      persist();
      route();
    }
  }
}

// 양 고르기 버튼. 개수 단위 → 한 그릇 → 그램 순서로 정해진 것을 쓴다.
function amountOptions(food) {
  if (food.custom === 'recipe') {
    return { opts: [0.5, 1, 1.5, 2].map((n) => ({ label: n === 0.5 ? '반 인분' : `${n}인분`, amount: n })), def: 1 };
  }
  const u = state.units[food.code];
  if (u) {
    const opts = [0.5, 1, 2, 3].map((n) => {
      const label = n === 0.5 ? `반 ${u.name}` : `${n}${u.name}`;
      return { label, sub: `${gText(n * u.amount)}${food.unit}`, amount: n * u.amount, amountLabel: label };
    });
    return { opts, def: 1 };
  }
  const s = state.servings[food.code];
  const word = servingWord(food);
  const opts = [];
  if (s) {
    for (const n of [0.5, 1, 1.5, 2]) {
      const label = n === 0.5 ? `반 ${word}` : `${n} ${word}`;
      opts.push({ label, sub: `${gText(n * s)}${food.unit}`, amount: n * s, amountLabel: label });
    }
  } else {
    for (const a of [50, 100, 150, 200]) opts.push({ label: `${a}${food.unit}`, amount: a });
  }
  const extra = food.custom === 'label' ? food.basis : food.size;
  if (extra && extra !== 100 && !opts.some((o) => o.amount === extra)) {
    const label = food.custom === 'label' ? '라벨 기준량' : food.rest ? '제품 1개' : '1인분';
    opts.push({ label, sub: `${gText(extra)}${food.unit}`, amount: extra });
  }
  return { opts, def: 1 };
}

function sourceLine(food) {
  const vals = `${basisText(food)}당 ${orBlank(food.kcal, (v) => `${kcalText(v)}kcal`)} · 단백질 ${orBlank(food.protein, (v) => `${gText(v)}g`)}`
    + ` · 칼륨 ${food.potassium == null ? '정보 없음' : `${gText(food.potassium)}mg${food.potassiumPartial ? ' (일부 정보 없음)' : ''}`}`;
  if (food.custom === 'recipe') return `영양 수치: 직접 만든 음식 (재료 수치를 더함), ${vals}`;
  if (food.custom === 'label') return `영양 수치: ${SOURCE_LABEL}, ${vals}`;
  return `영양 수치: 식품의약품안전처, ${vals}`;
}

function openAmountSheet(code) {
  const food = getFood(code);
  if (!food) return;
  const sheet = $('#sheet');
  let { opts, def } = amountOptions(food);
  let amount = opts[def].amount;
  let amountLabel = opts[def].amountLabel ?? null;
  const word = servingWord(food);
  const canRecord = isRecordable(food);
  const per = foodPer(food);

  const draw = () => {
    const n = mealNutrients({ per, basis: food.basis, amount });
    const fav = state.favorites.includes(food.code);
    const u = state.units[food.code];
    const resultHtml = canRecord
      ? `<p><b>${kcalText(n.kcal)}</b> kcal · 단백질 <b>${gText(n.protein)}</b> g</p>
         <p class="muted small">${esc(amountText(food.unit, amount, amountLabel))} 기준</p>
         ${potassiumNote(n, food)}`
      : `<p class="knote k-unknown">칼로리·단백질·기준량을 아직 입력하지 않았어요.<br>설정 → 직접 입력 음식에서 라벨 수치를 넣으면 기록할 수 있어요.</p>`;
    const fine = food.custom === 'recipe'
      ? `<details class="fine">
          <summary>재료 보기</summary>
          <ul class="ing-mini">${food.items.map((it) => `<li>${esc(it.name)} ${esc(amountText(it.unit, it.amount, it.amountLabel))}${it.source === SOURCE_LABEL ? ' (직접 입력)' : ''}</li>`).join('')}</ul>
          <p class="muted small">${esc(sourceLine(food))}</p>
        </details>`
      : `<details class="fine">
          <summary>양 직접 입력 · 한 ${word} 무게 · 개수 단위</summary>
          <label>직접 입력 <input id="custom" type="number" inputmode="decimal" min="1" step="1" value="${round1(amount)}"> ${food.unit}</label>
          <label>한 ${word} = <input id="serving" type="number" inputmode="decimal" min="1" step="1" value="${state.servings[food.code] ?? ''}" placeholder="예: 250"> ${food.unit}</label>
          <label>개수 단위 <input id="unit-name" class="short" type="text" maxlength="5" value="${esc(u?.name ?? '')}" placeholder="개">
            하나 = <input id="unit-amount" type="number" inputmode="decimal" min="1" step="1" value="${u?.amount ?? ''}" placeholder="예: 50"> ${food.unit}</label>
          <button class="btn-text" id="apply-fine">적용</button>
          <p class="muted small">${esc(sourceLine(food))}</p>
        </details>`;

    sheet.innerHTML = `
      <div class="sheet-body" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">${esc(food.name)}</h2>
        <p class="rest">${esc(food.rest || food.origin)}</p>
        ${canRecord ? `<p class="label">얼마나 드셨어요?</p>
        <div class="amounts">${opts.map((o, i) => `<button class="amount ${o.amount === amount && (o.amountLabel ?? null) === amountLabel ? 'on' : ''}" data-i="${i}">
          ${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>` : ''}
        <div class="result-box">${resultHtml}</div>
        <button class="btn btn-primary" id="save-meal" ${canRecord ? '' : 'disabled'}>기록하기</button>
        <div class="sheet-row">
          <button class="btn btn-secondary" id="fav">${fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button>
          <button class="btn btn-secondary" id="close">닫기</button>
        </div>
        ${canRecord ? fine : ''}
      </div>`;

    sheet.querySelectorAll('.amount').forEach((b) => b.addEventListener('click', () => {
      const o = opts[Number(b.dataset.i)];
      amount = o.amount;
      amountLabel = o.amountLabel ?? null;
      draw();
    }));
    $('#save-meal', sheet).addEventListener('click', () => {
      if (!canRecord) return;
      state.meals.push({
        id: newId(), date: today(), time: nowTime(), code: food.code, name: food.name, rest: food.rest,
        unit: food.unit, amount, amountLabel, basis: food.basis, per, source: food.source,
      });
      persist();
      closeSheet();
      lastQuery = '';
      toast('기록했어요! 👏');
      route();
    });
    $('#fav', sheet).addEventListener('click', () => {
      setFavorite(food.code, !fav);
      persist();
      draw();
    });
    $('#close', sheet).addEventListener('click', closeSheet);
    $('#apply-fine', sheet)?.addEventListener('click', () => {
      let unit;
      try {
        unit = parseCountUnit($('#unit-name', sheet).value, $('#unit-amount', sheet).value);
      } catch (err) {
        return toast(err.message);
      }
      const c = Number($('#custom', sheet).value);
      const s = Number($('#serving', sheet).value);
      const unitChanged = JSON.stringify(unit) !== JSON.stringify(state.units[food.code] ?? null);
      const servingChanged = s > 0 && s !== state.servings[food.code];
      if (unitChanged || servingChanged) {
        if (unitChanged) {
          if (unit) state.units[food.code] = unit;
          else delete state.units[food.code];
        }
        if (servingChanged) state.servings[food.code] = s;
        persist();
        ({ opts, def } = amountOptions(food));
        amount = opts[def].amount;
        amountLabel = opts[def].amountLabel ?? null;
      } else if (c > 0) {
        amount = c;
        amountLabel = null;
      }
      draw();
    });
  };
  draw();
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.classList.remove('sheet-open');
}

// ───────── 직접 만든 음식 (재료를 골라 1인분 만들기) ─────────
let recipeDraft = null;   // {forId, name, items, fav}
let pendingIng = null;    // 넣으려고 고른 재료 {food, amount, amountLabel}
let ingQuery = '';

function renderRecipe(params) {
  const id = params.get('id') || 'new';
  const existing = state.customFoods.find((c) => c.code === id && c.kind === 'recipe');
  if (!recipeDraft || recipeDraft.forId !== id) {
    recipeDraft = existing
      ? { forId: id, name: existing.name, items: JSON.parse(JSON.stringify(existing.items)), fav: state.favorites.includes(id) }
      : { forId: 'new', name: '', items: [], fav: true };
    pendingIng = null;
    ingQuery = '';
  }
  const d = recipeDraft;
  let total = null;
  if (d.items.length) total = recipeNutrients(d.items);

  let addHtml;
  if (pendingIng) {
    const f = pendingIng.food;
    const u = state.units[f.code];
    const unitBtns = u ? [0.5, 1, 2].map((n) => {
      const label = n === 0.5 ? `반 ${u.name}` : `${n}${u.name}`;
      return `<button class="amount ${pendingIng.amountLabel === label ? 'on' : ''}" data-ing-unit="${n}">${esc(label)}<small>${gText(n * u.amount)}${f.unit}</small></button>`;
    }).join('') : '';
    addHtml = `<div class="add-panel">
      <p><b>${esc(f.name)}</b> <span class="rest">${esc(f.rest || f.origin)} · ${basisText(f)}당 ${kcalText(f.kcal)}kcal</span></p>
      ${u ? `<div class="amounts three">${unitBtns}</div>` : ''}
      <label>양 <input id="ing-amount" type="number" inputmode="decimal" min="0.1" step="any" value="${pendingIng.amount ?? ''}" placeholder="숫자"> ${f.unit}</label>
      <div class="sheet-row">
        <button class="btn btn-primary" id="ing-add">재료 넣기</button>
        <button class="btn btn-secondary" id="ing-cancel">취소</button>
      </div>
    </div>`;
  } else {
    addHtml = `<input id="ing-q" class="search" type="search" placeholder="재료 찾기 (예: 쌀밥, 달걀)" autocomplete="off" value="${esc(ingQuery)}">
      <ul id="ing-results" class="results"></ul>
      <p class="small muted">식약처 자료와 직접 입력 음식(제품 라벨)에서 고를 수 있어요. 자료에 없는 재료(예: 참기름)는 먼저 설정 → 직접 입력 음식으로 등록해 주세요.</p>`;
  }

  view.innerHTML = `
    <header class="top"><h1>${existing ? '만든 음식 고치기' : '음식 만들기'}</h1><a class="settings-link" href="#settings">취소</a></header>
    <section class="card">
      <label class="field">음식 이름<input id="r-name" class="text-input" maxlength="30" value="${esc(d.name)}" placeholder="예: 간장계란밥"></label>
      <p class="label">1인분에 들어가는 재료</p>
      ${d.items.length ? `<ul class="list">${d.items.map((it, i) => {
        const n = mealNutrients(it);
        return `<li><div class="li-main"><b>${esc(it.name)}</b>
          <span>${esc(amountText(it.unit, it.amount, it.amountLabel))} · ${kcalText(n.kcal)}kcal · 단백질 ${gText(n.protein)}g${it.source === SOURCE_LABEL ? ' · 직접 입력' : ''}</span>
          ${potassiumBadge(n.potassium, n.potassiumPartial)}</div>
          <button class="btn-text" data-del-ing="${i}">빼기</button></li>`;
      }).join('')}</ul>` : '<p class="muted">아직 재료가 없어요.</p>'}
      <h2>재료 넣기</h2>
      ${addHtml}
    </section>
    <section class="card">
      <p class="label">1인분 합계</p>
      ${total ? `<p class="sum-line"><b>${kcalText(total.kcal)}</b> kcal · 단백질 <b>${gText(total.protein)}</b> g</p>
        ${potassiumNote(total, { custom: 'recipe' })}` : '<p class="muted">재료를 넣으면 계산돼요.</p>'}
      <p class="small muted">영양 수치는 재료 수치를 더한 값이에요.</p>
    </section>
    <label class="check"><input type="checkbox" id="r-fav" ${d.fav ? 'checked' : ''}> 즐겨찾기에 바로 추가</label>
    <button class="btn btn-primary" id="r-save">저장하기</button>
    ${existing ? '<button class="btn btn-secondary danger" id="r-del">이 음식 지우기</button>' : ''}`;

  $('#r-name').addEventListener('input', (e) => { d.name = e.target.value; });
  $('#r-fav').addEventListener('change', (e) => { d.fav = e.target.checked; });
  view.querySelectorAll('[data-del-ing]').forEach((b) => b.addEventListener('click', () => {
    d.items.splice(Number(b.dataset.delIng), 1);
    renderRecipe(params);
  }));

  if (pendingIng) {
    const f = pendingIng.food;
    view.querySelectorAll('[data-ing-unit]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.ingUnit);
      const u = state.units[f.code];
      pendingIng.amount = n * u.amount;
      pendingIng.amountLabel = n === 0.5 ? `반 ${u.name}` : `${n}${u.name}`;
      renderRecipe(params);
    }));
    $('#ing-amount').addEventListener('input', (e) => {
      pendingIng.amount = Number(e.target.value) || null;
      pendingIng.amountLabel = null;
      view.querySelectorAll('[data-ing-unit]').forEach((x) => x.classList.remove('on'));
    });
    $('#ing-add').addEventListener('click', () => {
      if (!(pendingIng.amount > 0)) return toast('재료의 양을 넣어 주세요.');
      d.items.push({
        code: f.code, name: f.name, unit: f.unit, basis: f.basis, amount: pendingIng.amount,
        amountLabel: pendingIng.amountLabel, per: foodPer(f), source: f.source,
      });
      pendingIng = null;
      ingQuery = '';
      renderRecipe(params);
    });
    $('#ing-cancel').addEventListener('click', () => { pendingIng = null; renderRecipe(params); });
  } else {
    const q = $('#ing-q');
    const results = $('#ing-results');
    const doSearch = () => {
      ingQuery = q.value;
      if (!foodsReady) {
        results.innerHTML = '<li class="muted">음식 정보를 불러오는 중이에요…</li>';
        return;
      }
      const hits = searchFoods(q.value, 30, ['label', 'data']);
      results.innerHTML = q.value.trim() && !hits.length
        ? '<li class="muted">찾는 재료가 없어요. 자료에 없으면 직접 입력 음식으로 등록해 주세요.</li>'
        : hits.map((f) => resultItem(f, 'data-ing')).join('');
    };
    q.addEventListener('input', doSearch);
    if (ingQuery) doSearch();
    results.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ing]');
      if (!b) return;
      const f = getFood(b.dataset.ing);
      if (!isRecordable(f)) return toast('이 음식은 아직 라벨 수치를 입력하지 않았어요.');
      const u = state.units[f.code];
      pendingIng = u ? { food: f, amount: u.amount, amountLabel: `1${u.name}` } : { food: f, amount: null, amountLabel: null };
      renderRecipe(params);
    });
  }

  $('#r-save').addEventListener('click', () => {
    const name = d.name.trim();
    if (!name) return toast('음식 이름을 써 주세요.');
    if (!d.items.length) return toast('재료를 하나 이상 넣어 주세요.');
    const t = recipeNutrients(d.items);
    const code = existing ? existing.code : `my-${newId()}`;
    upsertCustom({
      code, kind: 'recipe', name, items: d.items,
      kcal: t.kcal, protein: t.protein, potassium: t.potassium, potassiumPartial: t.potassiumPartial,
      updated: today(),
    });
    setFavorite(code, d.fav);
    persist();
    recipeDraft = null;
    toast(`"${name}"을(를) 저장했어요.`);
    location.hash = '#settings';
  });
  $('#r-del')?.addEventListener('click', () => {
    if (!confirm(`"${existing.name}"을(를) 지울까요?\n이미 기록한 식사는 그대로 남아요.`)) return;
    removeCustom(existing.code);
    persist();
    recipeDraft = null;
    location.hash = '#settings';
  });
}

// ───────── 직접 입력 음식 (제품 라벨) ─────────
function renderLabel(params) {
  const id = params.get('id') || 'new';
  const existing = state.customFoods.find((c) => c.code === id && c.kind === 'label');
  const c = existing || { name: '', basis: null, unit: null, kcal: null, protein: null, potassium: null };
  const u = existing ? state.units[existing.code] : null;
  let unit = c.unit;
  const val = (v) => (v == null ? '' : v);

  view.innerHTML = `
    <header class="top"><h1>${existing ? '직접 입력 음식 고치기' : '라벨 보고 등록하기'}</h1><a class="settings-link" href="#settings">취소</a></header>
    <p class="notice">포장지 영양성분표의 수치를 그대로 옮겨 적어 주세요. 모르는 칸은 비워 두면 '정보 없음'으로 처리돼요(0으로 계산하지 않아요).</p>
    <section class="card">
      <label class="field">음식 이름<input id="l-name" class="text-input" maxlength="30" value="${esc(c.name)}" placeholder="제품 이름"></label>
      <p class="label">라벨 기준량</p>
      <p class="small muted">라벨에 "1팩(200ml)당"처럼 적힌 기준이에요.</p>
      <div class="pair">
        <input id="l-basis" type="number" inputmode="decimal" min="0" step="any" value="${val(c.basis)}">
        <div class="chips" role="group" aria-label="기준량 단위">
          <button class="chip ${unit === 'g' ? 'on' : ''}" data-unit="g">g</button>
          <button class="chip ${unit === 'ml' ? 'on' : ''}" data-unit="ml">ml</button>
        </div>
      </div>
      <label class="row">칼로리 <input id="l-kcal" type="number" inputmode="decimal" min="0" step="any" value="${val(c.kcal)}"> kcal</label>
      <label class="row">단백질 <input id="l-protein" type="number" inputmode="decimal" min="0" step="any" value="${val(c.protein)}"> g</label>
      <label class="row">칼륨 <input id="l-potassium" type="number" inputmode="decimal" min="0" step="any" value="${val(c.potassium)}"> mg</label>
      <p class="small muted">라벨에 칼륨이 없으면 비워 두세요. "칼륨 정보 없음"으로 보여요.</p>
      <label class="row">포장 단위 <input id="l-unitname" class="short" type="text" maxlength="5" value="${esc(u?.name ?? '')}" placeholder="팩"></label>
      <p class="small muted">쓰면 기록할 때 "1팩 = 기준량"으로 고를 수 있어요. (선택)</p>
      <p class="small">출처 표시: <b>${SOURCE_LABEL}</b></p>
    </section>
    <label class="check"><input type="checkbox" id="l-fav" ${!existing || state.favorites.includes(existing.code) ? 'checked' : ''}> 즐겨찾기에 바로 추가</label>
    <button class="btn btn-primary" id="l-save">저장하기</button>
    ${existing ? '<button class="btn btn-secondary danger" id="l-del">이 음식 지우기</button>' : ''}`;

  view.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => {
    unit = b.dataset.unit;
    view.querySelectorAll('[data-unit]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#l-save').addEventListener('click', () => {
    let f, countUnit = null;
    try {
      f = parseLabelFood({
        name: $('#l-name').value, basis: $('#l-basis').value, unit,
        kcal: $('#l-kcal').value, protein: $('#l-protein').value, potassium: $('#l-potassium').value,
      });
      const un = $('#l-unitname').value.trim();
      if (un) {
        if (f.basis === null) throw new Error('포장 단위를 쓰려면 라벨 기준량도 넣어 주세요.');
        countUnit = parseCountUnit(un, f.basis);
      }
    } catch (err) {
      return toast(err.message);
    }
    const code = existing ? existing.code : `my-${newId()}`;
    upsertCustom({ code, kind: 'label', ...f, updated: today() });
    if (countUnit) state.units[code] = countUnit;
    else delete state.units[code];
    setFavorite(code, $('#l-fav').checked);
    refreshRecipesUsing(code);
    persist();
    toast(isRecordable(getFood(code)) ? `"${f.name}"을(를) 저장했어요.` : `"${f.name}"을(를) 저장했어요. 수치를 채우면 기록할 수 있어요.`);
    location.hash = '#settings';
  });
  $('#l-del')?.addEventListener('click', () => {
    if (!confirm(`"${existing.name}"을(를) 지울까요?\n이미 기록한 식사와 이 재료로 만든 음식은 그대로 남아요.`)) return;
    removeCustom(existing.code);
    persist();
    location.hash = '#settings';
  });
}

// 라벨 수치를 고치면 그 음식을 재료로 쓴 '직접 만든 음식'도 다시 계산한다.
function refreshRecipesUsing(code) {
  const f = getFood(code);
  if (!isRecordable(f)) return;
  for (const r of state.customFoods) {
    if (r.kind !== 'recipe' || !r.items.some((it) => it.code === code)) continue;
    r.items = r.items.map((it) => (it.code === code ? { ...it, name: f.name, unit: f.unit, basis: f.basis, per: foodPer(f) } : it));
    Object.assign(r, recipeNutrients(r.items));
    delete r.missingCount;
  }
  setCustomFoods(state.customFoods);
}

// ───────── 체중 ─────────
function renderWeight() {
  const last = latestWeight(state.weights);
  const timings = state.settings.timings;
  const kg = last ? last.kg : '';
  let timing = last && timings.includes(last.timing) ? last.timing : timings[0];
  const recent = [...state.weights].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 10);

  view.innerHTML = `
    <h1>체중 기록</h1>
    <section class="card">
      <p class="label">몸무게</p>
      <div class="stepper">
        <button class="step" id="minus" aria-label="0.1 kg 빼기">−</button>
        <label class="kg-input"><input id="kg" type="number" inputmode="decimal" step="0.1" min="10" max="150" value="${kg}" placeholder="0.0"><span>kg</span></label>
        <button class="step" id="plus" aria-label="0.1 kg 더하기">+</button>
      </div>
      <p class="label">날짜</p>
      <input id="wdate" class="date-input" type="date" value="${today()}" max="${today()}">
      <p class="label">언제 재셨어요?</p>
      <div class="chips" role="group" aria-label="측정 시점">
        ${timings.map((t) => `<button class="chip ${t === timing ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      <button class="btn btn-primary" id="save-weight">저장하기</button>
    </section>
    <section>
      <h2>최근 기록</h2>
      ${recent.length ? `<ul class="list">${recent.map((w) => {
        const [, m, d] = w.date.split('-').map(Number);
        return `<li><div class="li-main"><b>${w.kg}kg</b><span>${m}월 ${d}일 · ${esc(w.timing)}</span></div>
          <button class="btn-text" data-del-weight="${w.id}">지우기</button></li>`;
      }).join('')}</ul>` : '<p class="muted">아직 기록이 없어요.</p>'}
    </section>`;

  const input = $('#kg');
  const bump = (d) => {
    if (input.value === '') return input.focus(); // 처음에는 숫자를 직접 입력
    input.value = round1(Number(input.value) + d).toFixed(1);
  };
  $('#minus').addEventListener('click', () => bump(-0.1));
  $('#plus').addEventListener('click', () => bump(0.1));
  view.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    timing = b.dataset.t;
    view.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#save-weight').addEventListener('click', () => {
    const v = round1(Number(input.value));
    const date = $('#wdate').value || today();
    if (!(v >= 10 && v <= 150)) {
      toast('몸무게 숫자를 다시 확인해 주세요.');
      return;
    }
    state.weights.push({ id: newId(), date, time: date === today() ? nowTime() : '', kg: v, timing });
    persist();
    toast('체중을 저장했어요. 고마워요!');
    location.hash = '#home';
  });
  view.querySelectorAll('[data-del-weight]').forEach((b) => b.addEventListener('click', () => {
    const w = state.weights.find((x) => x.id === b.dataset.delWeight);
    if (w && confirm(`${w.kg}kg 기록을 지울까요?`)) {
      state.weights = state.weights.filter((x) => x.id !== w.id);
      persist();
      renderWeight();
    }
  }));
}

// ───────── 설정 (보호자용) ─────────
function renderSettings() {
  const s = state.settings;
  const meta = getMeta();
  const codes = [...new Set([...state.favorites, ...[...state.meals].reverse().map((m) => m.code)])].slice(0, 30);
  const foods = codes.map(getFood).filter((f) => f && f.custom !== 'recipe' && isRecordable(f));
  const recipes = state.customFoods.filter((c) => c.kind === 'recipe');
  const labels = state.customFoods.filter((c) => c.kind === 'label');

  view.innerHTML = `
    <header class="top"><h1>설정</h1><a class="settings-link" href="#home">닫기</a></header>
    <p class="muted">보호자용 설정이에요.</p>

    <section class="card">
      <h2>목표 체중</h2>
      <div class="pair">
        <label><input id="goalLow" type="number" inputmode="decimal" step="0.5" value="${s.goalLow ?? ''}"> kg</label>
        <span>~</span>
        <label><input id="goalHigh" type="number" inputmode="decimal" step="0.5" value="${s.goalHigh ?? ''}"> kg</label>
      </div>
      <p class="small muted">범위로 쓰거나 한 칸만 써도 돼요. 비워 두면 목표를 표시하지 않아요.</p>
    </section>

    <section class="card">
      <h2>체중 측정 시점</h2>
      <p class="small muted">체중 기록할 때 고르는 버튼이에요. 쉼표로 나눠 6개까지 쓸 수 있어요.</p>
      <input id="timings" class="text-input" type="text" value="${esc(s.timings.join(', '))}">
    </section>

    <section class="card">
      <h2>칼륨 표시 기준</h2>
      <p class="notice">⚠ 병원 기준으로 확인하세요. 아래 값은 기본값일 뿐이에요.</p>
      <p class="small">기록하는 양(한 번에 드시는 양) 기준으로 나눠요.</p>
      <label class="row">적음: <input id="kLow" type="number" inputmode="numeric" min="0" value="${s.kLow}"> mg 미만</label>
      <label class="row">많음: <input id="kHigh" type="number" inputmode="numeric" min="0" value="${s.kHigh}"> mg 이상</label>
      <p class="small muted">그 사이는 "보통", 칼륨 값이 없는 음식은 "칼륨 정보 없음"으로 보여요.</p>
    </section>
    <button class="btn btn-primary" id="save-settings">설정 저장</button>

    <section class="card">
      <h2>직접 만든 음식</h2>
      <p class="small muted">재료를 골라 1인분을 만들어 두면 한 번에 기록할 수 있어요. 영양 수치는 재료 수치를 더한 값이에요.</p>
      ${recipes.length ? `<ul class="list">${recipes.map((r) => `<li>
        <div class="li-main"><b>${esc(r.name)}</b><span>1인분 ${kcalText(r.kcal)}kcal · 단백질 ${gText(r.protein)}g · 재료 ${r.items.length}개</span>
        ${potassiumBadge(r.potassium, r.potassiumPartial)}</div>
        <a class="btn-text" href="#recipe?id=${encodeURIComponent(r.code)}">고치기</a></li>`).join('')}</ul>` : ''}
      <a class="btn btn-secondary" href="#recipe?id=new">새 음식 만들기</a>
    </section>

    <section class="card">
      <h2>직접 입력 음식 (제품 라벨)</h2>
      <p class="small muted">포장지 영양성분표를 보고 칼로리·단백질·칼륨을 직접 넣어요. 출처는 "${SOURCE_LABEL}"로 표시돼요.</p>
      ${labels.length ? `<ul class="list">${labels.map((c) => {
        const f = getFood(c.code);
        return `<li><div class="li-main"><b>${esc(c.name)}</b>
          <span>${isRecordable(f) ? `${basisText(f)}당 ${kcalText(f.kcal)}kcal · 단백질 ${gText(f.protein)}g` : '<span class="tag">수치 입력 필요</span>'}</span></div>
          <a class="btn-text" href="#label?id=${encodeURIComponent(c.code)}">고치기</a></li>`;
      }).join('')}</ul>` : ''}
      <a class="btn btn-secondary" href="#label?id=new">라벨 보고 등록하기</a>
    </section>

    <section class="card">
      <h2>한 그릇 무게 · 개수 단위</h2>
      <p class="small muted">한 그릇 무게나 "1개 = 50g" 같은 단위를 정해 두면 기록할 때 "1그릇", "2개"로 고를 수 있어요. 즐겨찾기와 최근 드신 음식이 여기에 나와요.</p>
      ${foods.length ? `<ul class="serv-list">${foods.map((f) => {
        const u = state.units[f.code];
        return `<li data-food="${esc(f.code)}">
        <span>${esc(f.name)}${f.rest ? ` <small>(${esc(f.rest)})</small>` : ''}</span>
        <label>1${servingWord(f)} = <input type="number" inputmode="decimal" min="1" data-serv value="${state.servings[f.code] ?? ''}" placeholder="-"> ${f.unit}</label>
        <label>단위 <input class="short" type="text" maxlength="5" data-unit-name value="${esc(u?.name ?? '')}" placeholder="개">
          하나 = <input type="number" inputmode="decimal" min="1" data-unit-amount value="${u?.amount ?? ''}" placeholder="-"> ${f.unit}</label>
      </li>`;
      }).join('')}</ul>
      <button class="btn btn-secondary" id="save-serv">무게·단위 저장</button>` : '<p class="muted">음식을 기록하거나 즐겨찾기하면 여기에 나와요.</p>'}
    </section>

    <section class="card">
      <h2>백업</h2>
      <p class="small muted">기록, 직접 만든 음식, 직접 입력 음식, 단위 설정은 이 폰의 브라우저에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 내보내 두세요.</p>
      <button class="btn btn-secondary" id="export">백업 내보내기</button>
      <label class="btn btn-secondary file-btn">백업 불러오기<input id="import" type="file" accept="application/json,.json" hidden></label>
    </section>

    <section class="card source">
      <h2>음식 영양 정보 출처</h2>
      ${meta ? `<p>${esc(meta.database)}<br>공공데이터포털 「${esc(meta.title)}」<br>제공: ${esc(meta.provider)}</p>
      <p>데이터 기준일: <b>${esc(meta.baseDate)}</b><br>앱에 넣은 날: ${esc(meta.downloaded)}<br>음식 ${meta.count.toLocaleString('ko-KR')}개</p>
      <p class="small muted">${esc(meta.url)}</p>` : '<p class="muted">불러오는 중…</p>'}
      <p class="small muted">직접 입력 음식은 "${SOURCE_LABEL}", 직접 만든 음식은 재료 수치를 더한 값으로 표시돼요.</p>
      <p class="small muted">이 앱은 식사와 체중 기록을 돕는 도구이며 의학적 조언을 하지 않아요. 식사와 관련된 결정은 담당 의료진과 상의해 주세요.</p>
    </section>`;

  $('#save-settings').addEventListener('click', () => {
    const n = (id) => Number($(id).value);
    let next;
    try {
      next = {
        ...parseGoal($('#goalLow').value, $('#goalHigh').value),
        timings: parseTimings($('#timings').value),
        kLow: n('#kLow'), kHigh: n('#kHigh'),
      };
    } catch (err) {
      return toast(err.message);
    }
    if (!(next.kLow >= 0 && next.kHigh > next.kLow)) return toast('칼륨 기준: "많음" 값이 "적음" 값보다 커야 해요.');
    state.settings = { ...state.settings, ...next };
    persist();
    toast('설정을 저장했어요.');
  });
  $('#save-serv')?.addEventListener('click', () => {
    const servings = { ...state.servings };
    const units = { ...state.units };
    try {
      view.querySelectorAll('[data-food]').forEach((li) => {
        const code = li.dataset.food;
        const v = Number($('[data-serv]', li).value);
        if (v > 0) servings[code] = v;
        else delete servings[code];
        const u = parseCountUnit($('[data-unit-name]', li).value, $('[data-unit-amount]', li).value);
        if (u) units[code] = u;
        else delete units[code];
      });
    } catch (err) {
      return toast(err.message);
    }
    state.servings = servings;
    state.units = units;
    persist();
    toast('무게와 단위를 저장했어요.');
  });
  $('#export').addEventListener('click', () => {
    const blob = new Blob([exportJson(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `식사기록-백업-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const next = importJson(await file.text());
      if (!confirm(`식사 ${next.meals.length}건, 체중 ${next.weights.length}건, 직접 등록한 음식 ${next.customFoods.length}개를 불러올까요?\n지금 폰에 있는 기록은 이 백업으로 바뀌어요.`)) return;
      state = next;
      setCustomFoods(state.customFoods);
      persist();
      toast('백업을 불러왔어요.');
      renderSettings();
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  });
}

// ───────── 화면 전환 ─────────
const routes = {
  home: renderHome, meal: renderMeal, weight: renderWeight, settings: renderSettings,
  recipe: renderRecipe, label: renderLabel,
};
const NEEDS_FOODS = ['meal', 'settings', 'recipe'];

function route() {
  const [name, query] = location.hash.slice(1).split('?');
  const key = routes[name] ? name : 'home';
  view.removeEventListener('click', onMealClick);
  closeSheet();
  const params = new URLSearchParams(query || '');
  if (key === 'meal' && params.has('q')) lastQuery = params.get('q');
  routes[key](params);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${key}`));
  window.scrollTo(0, 0);
  if (key === 'meal' && params.has('food') && foodsReady) openAmountSheet(params.get('food'));
}

window.addEventListener('hashchange', route);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
route();

loadFoods().then(() => {
  foodsReady = true;
  const name = location.hash.slice(1).split('?')[0];
  if (NEEDS_FOODS.includes(name)) route();
}).catch(() => {
  toast('음식 정보를 불러오지 못했어요. 다시 열어 주세요.');
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}

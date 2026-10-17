import {
  localDate, mealNutrients, compareToday, potassiumLevel, POTASSIUM_LABEL,
  latestWeight, remainingToGoal, round1, cheerMessage, goalText, parseGoal, parseTimings,
} from './calc.js';
import { load, save, newId, exportJson, importJson } from './store.js';
import { loadFoods, getFood, getMeta, searchFoods } from './foods.js';
import { renderWeightChart } from './chart.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

let state = load();
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

function potassiumBadge(mg) {
  const lv = potassiumLevel(mg, state.settings);
  const text = lv === 'unknown' ? POTASSIUM_LABEL.unknown : `칼륨 ${POTASSIUM_LABEL[lv]}`;
  return `<span class="kbadge k-${lv}">${text}</span>`;
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
            <span>${gText(m.amount)}${m.unit} · ${kcalText(n.kcal)}kcal · 단백질 ${gText(n.protein)}g</span>
            ${potassiumBadge(n.potassium)}</div>
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
      : hits.map((f) => `<li><button class="result" data-code="${esc(f.code)}">
          <b>${esc(f.name)}</b>
          <span class="rest">${esc(f.rest || f.origin)} · ${f.unit === 'ml' ? '100ml' : '100g'}당 ${kcalText(f.kcal)}kcal</span>
        </button></li>`).join('');
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

// 양 고르기 창
function amountOptions(food) {
  const s = state.servings[food.code];
  const word = servingWord(food);
  const opts = [];
  if (s) {
    for (const n of [0.5, 1, 1.5, 2]) {
      const label = n === 0.5 ? `반 ${word}` : `${n} ${word}`;
      opts.push({ label, sub: `${gText(n * s)}${food.unit}`, amount: n * s });
    }
  } else {
    for (const a of [50, 100, 150, 200]) opts.push({ label: `${a}${food.unit}`, amount: a });
  }
  if (food.size && food.size !== 100 && !opts.some((o) => o.amount === food.size)) {
    opts.push({ label: food.rest ? '제품 1개' : '1인분', sub: `${gText(food.size)}${food.unit}`, amount: food.size });
  }
  return opts;
}

function openAmountSheet(code) {
  const food = getFood(code);
  if (!food) return;
  const sheet = $('#sheet');
  const opts = amountOptions(food);
  let amount = opts[1].amount; // 1그릇 또는 100g
  const word = servingWord(food);

  const draw = () => {
    const per100 = { kcal: food.kcal, protein: food.protein, potassium: food.potassium };
    const n = mealNutrients({ per100, amount });
    const lv = potassiumLevel(n.potassium, state.settings);
    const fav = state.favorites.includes(food.code);
    let kNote;
    if (lv === 'unknown') kNote = '<p class="knote k-unknown">칼륨 정보 없음 (이 음식은 자료에 칼륨 값이 없어요)</p>';
    else if (lv === 'high') kNote = `<p class="knote k-high">이 양에는 칼륨이 많은 편이에요 (약 ${kcalText(n.potassium)}mg).<br>기록은 그대로 하실 수 있어요.</p>`;
    else kNote = `<p class="knote k-${lv}">칼륨 ${POTASSIUM_LABEL[lv]} (약 ${kcalText(n.potassium)}mg)</p>`;

    sheet.innerHTML = `
      <div class="sheet-body" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">${esc(food.name)}</h2>
        <p class="rest">${esc(food.rest || food.origin)}</p>
        <p class="label">얼마나 드셨어요?</p>
        <div class="amounts">${opts.map((o, i) => `<button class="amount ${o.amount === amount ? 'on' : ''}" data-i="${i}">
          ${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>
        <div class="result-box">
          <p><b>${kcalText(n.kcal)}</b> kcal · 단백질 <b>${gText(n.protein)}</b> g</p>
          <p class="muted small">${gText(amount)}${food.unit} 기준</p>
          ${kNote}
        </div>
        <button class="btn btn-primary" id="save-meal">기록하기</button>
        <div class="sheet-row">
          <button class="btn btn-secondary" id="fav">${fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button>
          <button class="btn btn-secondary" id="close">닫기</button>
        </div>
        <details class="fine">
          <summary>양 직접 입력 · 한 ${word} 무게 정하기</summary>
          <label>직접 입력 <input id="custom" type="number" inputmode="decimal" min="1" step="1" value="${round1(amount)}"> ${food.unit}</label>
          <label>한 ${word} = <input id="serving" type="number" inputmode="decimal" min="1" step="1" value="${state.servings[food.code] ?? ''}" placeholder="예: 250"> ${food.unit}</label>
          <button class="btn-text" id="apply-fine">적용</button>
          <p class="muted small">영양 수치: 식품의약품안전처, ${food.unit === 'ml' ? '100ml' : '100g'}당 ${kcalText(food.kcal)}kcal · 단백질 ${gText(food.protein)}g · 칼륨 ${food.potassium == null ? '정보 없음' : `${food.potassium}mg`}</p>
        </details>
      </div>`;

    sheet.querySelectorAll('.amount').forEach((b) => b.addEventListener('click', () => {
      amount = opts[Number(b.dataset.i)].amount;
      draw();
    }));
    $('#save-meal', sheet).addEventListener('click', () => {
      state.meals.push({
        id: newId(), date: today(), time: nowTime(), code: food.code, name: food.name, rest: food.rest,
        unit: food.unit, amount, per100,
      });
      persist();
      closeSheet();
      lastQuery = '';
      toast('기록했어요! 👏');
      route();
    });
    $('#fav', sheet).addEventListener('click', () => {
      state.favorites = fav ? state.favorites.filter((c) => c !== food.code) : [...state.favorites, food.code];
      persist();
      draw();
    });
    $('#close', sheet).addEventListener('click', closeSheet);
    $('#apply-fine', sheet).addEventListener('click', () => {
      const c = Number($('#custom', sheet).value);
      const s = Number($('#serving', sheet).value);
      if (s > 0 && s !== state.servings[food.code]) {
        state.servings[food.code] = s;
        persist();
        const nOpts = amountOptions(food);
        opts.splice(0, opts.length, ...nOpts);
        amount = s;
      } else if (c > 0) {
        amount = c;
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
  const foods = codes.map(getFood).filter(Boolean);

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
      <h2>한 그릇(잔) 무게</h2>
      <p class="small muted">자료의 영양 수치는 100g(또는 100ml) 기준이에요. 무게를 정해 두면 "1그릇" 단위로 고를 수 있어요. 즐겨찾기와 최근 드신 음식이 여기에 나와요.</p>
      ${foods.length ? `<ul class="serv-list">${foods.map((f) => `<li>
        <span>${esc(f.name)}${f.rest ? ` <small>(${esc(f.rest)})</small>` : ''}</span>
        <label>1${servingWord(f)} = <input type="number" inputmode="decimal" min="1" data-serv="${esc(f.code)}" value="${state.servings[f.code] ?? ''}" placeholder="-"> ${f.unit}</label>
      </li>`).join('')}</ul>
      <button class="btn btn-secondary" id="save-serv">무게 저장</button>` : '<p class="muted">음식을 기록하거나 즐겨찾기하면 여기에 나와요.</p>'}
    </section>

    <section class="card">
      <h2>백업</h2>
      <p class="small muted">기록은 이 폰의 브라우저에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 내보내 두세요.</p>
      <button class="btn btn-secondary" id="export">백업 내보내기</button>
      <label class="btn btn-secondary file-btn">백업 불러오기<input id="import" type="file" accept="application/json,.json" hidden></label>
    </section>

    <section class="card source">
      <h2>음식 영양 정보 출처</h2>
      ${meta ? `<p>${esc(meta.database)}<br>공공데이터포털 「${esc(meta.title)}」<br>제공: ${esc(meta.provider)}</p>
      <p>데이터 기준일: <b>${esc(meta.baseDate)}</b><br>앱에 넣은 날: ${esc(meta.downloaded)}<br>음식 ${meta.count.toLocaleString('ko-KR')}개</p>
      <p class="small muted">${esc(meta.url)}</p>` : '<p class="muted">불러오는 중…</p>'}
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
    view.querySelectorAll('[data-serv]').forEach((i) => {
      const v = Number(i.value);
      if (v > 0) state.servings[i.dataset.serv] = v;
      else delete state.servings[i.dataset.serv];
    });
    persist();
    toast('무게를 저장했어요.');
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
      if (!confirm(`식사 ${next.meals.length}건, 체중 ${next.weights.length}건을 불러올까요?\n지금 폰에 있는 기록은 이 백업으로 바뀌어요.`)) return;
      state = next;
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
const routes = { home: renderHome, meal: renderMeal, weight: renderWeight, settings: renderSettings };

function route() {
  const [name, query] = location.hash.slice(1).split('?');
  const key = routes[name] ? name : 'home';
  view.removeEventListener('click', onMealClick);
  closeSheet();
  const params = new URLSearchParams(query || '');
  if (key === 'meal' && params.has('q')) lastQuery = params.get('q');
  routes[key]();
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
  if (name === 'meal' || name === 'settings') route();
}).catch(() => {
  toast('음식 정보를 불러오지 못했어요. 다시 열어 주세요.');
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}


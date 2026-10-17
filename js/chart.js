// 체중 선 그래프 (SVG). 측정 시점에 따라 체중이 다를 수 있어서, 한 번에 한 측정 시점만 그린다.

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

function dayNum(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

// points: [{date, kg}] 날짜 오름차순. 목표 체중을 아직 입력하지 않았으면 goalLow 가 null.
export function renderWeightChart(box, points, goalLow, goalHigh) {
  const hasGoal = goalLow != null;
  if (hasGoal && goalHigh == null) goalHigh = goalLow;
  box.innerHTML = '';
  if (!points.length) {
    box.innerHTML = '<p class="chart-empty">체중을 기록하면 여기에 그래프가 생겨요.</p>';
    return;
  }
  const W = Math.max(280, box.clientWidth || 340);
  const H = 230;
  const m = { l: 44, r: 16, t: 16, b: 34 };
  const kgs = points.map((p) => p.kg);
  const range = hasGoal ? [...kgs, goalLow, goalHigh] : kgs;
  let lo = Math.floor(Math.min(...range) - 1);
  let hi = Math.ceil(Math.max(...range) + 0.5);
  if (hi - lo < 4) hi = lo + 4; // 값이 거의 같아도 눈금이 보이도록
  const single = points.length === 1;
  // 기록이 하나면 점을 가운데에 둔다. 아니면 최소 일주일 폭.
  const x0 = dayNum(points[0].date) - (single ? 3 : 0);
  const x1 = single ? x0 + 6 : Math.max(dayNum(points.at(-1).date), x0 + 6);
  const X = (d) => m.l + ((dayNum(d) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (kg) => m.t + ((hi - kg) / (hi - lo)) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart', role: 'img',
    'aria-label': `체중 그래프. 최근 ${points.at(-1).kg}kg` + (hasGoal ? `, 목표 ${goalLow}~${goalHigh}kg` : '') });
  box.append(svg); // 글자 폭을 재려면 먼저 화면에 붙어 있어야 한다
  let goalLabel = null;

  // 목표 구간 (구간이 좁아도 보이도록 최소 높이 6px)
  if (hasGoal) {
    const top = Math.min(Y(goalHigh), Y(goalLow) - 6);
    svg.append(el('rect', { x: m.l, y: top, width: W - m.l - m.r, height: Y(goalLow) - top, class: 'goal-band', rx: 4 }));
    const labelY = Y(goalLow) - top >= 26 ? top + 20 : top - 6; // 구간이 좁으면 위쪽에
    goalLabel = el('text', { x: W - m.r - 6, y: labelY, 'text-anchor': 'end', class: 'goal-label' }, '목표');
    svg.append(goalLabel);
  }

  // 눈금 (2kg 간격)
  const step = hi - lo > 14 ? 4 : 2;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }));
    svg.append(el('text', { x: m.l - 8, y: Y(v) + 5, 'text-anchor': 'end', class: 'tick' }, v));
  }
  // 날짜: 처음과 마지막
  svg.append(el('text', { x: X(points[0].date), y: H - 8, 'text-anchor': single ? 'middle' : 'start', class: 'tick' }, shortDate(points[0].date)));
  if (points.length > 1) {
    svg.append(el('text', { x: X(points.at(-1).date), y: H - 8, 'text-anchor': 'end', class: 'tick' }, shortDate(points.at(-1).date)));
  }

  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.kg).toFixed(1)}`).join('');
    svg.append(el('path', { d, class: 'line' }));
  }
  for (const p of points) {
    svg.append(el('circle', { cx: X(p.date), cy: Y(p.kg), r: 5, class: 'dot' }));
  }
  const last = points.at(-1);
  placeValueLabel(svg, `${last.kg}kg`, X(last.date), Y(last.kg), { left: m.l + 4, right: W - 4, top: 2, bottom: H - m.b }, goalLabel);

  // 눌러서 값 보기
  const focus = el('circle', { r: 9, class: 'focus', visibility: 'hidden' });
  svg.append(focus);
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  const hit = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
  svg.append(hit);
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(X(p.date) - px) < Math.abs(X(best.date) - px)) best = p;
    focus.setAttribute('cx', X(best.date));
    focus.setAttribute('cy', Y(best.kg));
    focus.setAttribute('visibility', 'visible');
    tip.textContent = `${shortDate(best.date)}  ${best.kg}kg`;
    tip.hidden = false;
    // 말풍선이 그래프 밖으로 잘리지 않게: 좌우는 폭의 절반만큼 안쪽, 위가 모자라면 점 아래에
    const half = tip.offsetWidth / 2;
    const left = (X(best.date) / W) * r.width;
    const py = (Y(best.kg) / H) * r.height;
    tip.style.left = `${Math.min(Math.max(left, half), r.width - half)}px`;
    tip.style.top = `${py - 54 >= 0 ? py - 54 : py + 16}px`;
  };
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'mouse') show(ev); });
  hit.addEventListener('pointerleave', () => { tip.hidden = true; focus.setAttribute('visibility', 'hidden'); });

  box.append(tip);
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// 점 옆 값 라벨을 그래프 안쪽에 둔다. 점 위 가운데가 기본이고, 좌우 끝에서는 안쪽으로 밀고,
// 위가 모자라거나 '목표' 글자와 겹치면 점 아래로 옮긴다.
export function placeValueLabel(svg, text, px, py, bounds, avoid) {
  const label = el('text', { x: 0, y: 0, class: 'last-label' }, text);
  svg.append(label);
  let { y: ascent, width: w, height: h } = label.getBBox(); // y=0 기준선에서 잰 글자 상자
  if (!w) { w = text.length * 11; h = 22; ascent = -18; } // 화면에 그려지지 않았을 때 대략값
  const x = Math.min(Math.max(px - w / 2, bounds.left), bounds.right - w);
  const avoidBox = avoid ? avoid.getBBox() : null;
  const gap = 10; // 점(반지름 5)과의 간격
  const candidates = [py - gap - h, py + gap]; // 라벨 윗변 y: 점 위, 점 아래
  let top = candidates.find((t) => {
    if (t < bounds.top || t + h > bounds.bottom) return false;
    return !(avoidBox && overlaps({ x, y: t, width: w, height: h }, avoidBox));
  });
  if (top === undefined) top = Math.min(Math.max(candidates[0], bounds.top), bounds.bottom - h);
  label.setAttribute('x', x.toFixed(1));
  label.setAttribute('y', (top - ascent).toFixed(1)); // 상자 윗변이 top 에 오도록 기준선을 맞춘다
  return label;
}

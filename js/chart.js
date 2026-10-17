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
  const x0 = dayNum(points[0].date);
  const x1 = Math.max(dayNum(points.at(-1).date), x0 + 6); // 최소 일주일 폭
  const X = (d) => m.l + ((dayNum(d) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (kg) => m.t + ((hi - kg) / (hi - lo)) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart', role: 'img',
    'aria-label': `체중 그래프. 최근 ${points.at(-1).kg}kg` + (hasGoal ? `, 목표 ${goalLow}~${goalHigh}kg` : '') });

  // 목표 구간 (구간이 좁아도 보이도록 최소 높이 6px)
  if (hasGoal) {
    const top = Math.min(Y(goalHigh), Y(goalLow) - 6);
    svg.append(el('rect', { x: m.l, y: top, width: W - m.l - m.r, height: Y(goalLow) - top, class: 'goal-band', rx: 4 }));
    const labelY = Y(goalLow) - top >= 26 ? top + 20 : top - 6; // 구간이 좁으면 위쪽에
    svg.append(el('text', { x: W - m.r - 6, y: labelY, 'text-anchor': 'end', class: 'goal-label' }, '목표'));
  }

  // 눈금 (2kg 간격)
  const step = hi - lo > 14 ? 4 : 2;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }));
    svg.append(el('text', { x: m.l - 8, y: Y(v) + 5, 'text-anchor': 'end', class: 'tick' }, v));
  }
  // 날짜: 처음과 마지막
  svg.append(el('text', { x: X(points[0].date), y: H - 8, 'text-anchor': 'start', class: 'tick' }, shortDate(points[0].date)));
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
  svg.append(el('text', { x: Math.min(X(last.date), W - m.r - 4), y: Y(last.kg) - 14, 'text-anchor': 'end', class: 'last-label' }, `${last.kg}kg`));

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
    const left = (X(best.date) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 60), r.width - 60)}px`;
    tip.style.top = `${(Y(best.kg) / H) * r.height - 54}px`;
  };
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'mouse') show(ev); });
  hit.addEventListener('pointerleave', () => { tip.hidden = true; focus.setAttribute('visibility', 'hidden'); });

  box.append(svg, tip);
}

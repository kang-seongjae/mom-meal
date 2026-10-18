// 함께 자라는 친구 그림 (SVG). 이 앱을 위해 단순한 동그라미 모양으로 직접 그린 동물들이다.
// form: 0 아기, 1 새싹, 2 목도리, 3 꽃, 4 꽃왕관(목표 도착) / scale: 단계마다 조금씩 커진다
// mood: 'normal' | 'happy'(다 먹은 날·자란 날) | 'cheer'(몸무게가 줄어든 날, 응원)
import { PETS, FORMS } from './grow.js';

const INK = '#5b4636';
const COLORS = {
  bunny: { body: '#fff3f6', inner: '#ffc4d4', belly: '#ffffff' },
  chick: { body: '#ffe27a', inner: '#ffb547', belly: '#fff2b8' },
  bear: { body: '#e3b58b', inner: '#f5d9bd', belly: '#f5d9bd' },
  cat: { body: '#d3dfee', inner: '#ffc4d4', belly: '#f1f5fa' },
};

function ears(kind, c) {
  if (kind === 'bunny') {
    return `
      <ellipse cx="78" cy="42" rx="13" ry="34" transform="rotate(-12 78 42)" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="78" cy="44" rx="6" ry="22" transform="rotate(-12 78 44)" fill="${c.inner}"/>
      <ellipse cx="122" cy="42" rx="13" ry="34" transform="rotate(12 122 42)" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="122" cy="44" rx="6" ry="22" transform="rotate(12 122 44)" fill="${c.inner}"/>`;
  }
  if (kind === 'bear') {
    return `
      <circle cx="62" cy="52" r="17" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
      <circle cx="62" cy="52" r="8" fill="${c.inner}"/>
      <circle cx="138" cy="52" r="17" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
      <circle cx="138" cy="52" r="8" fill="${c.inner}"/>`;
  }
  if (kind === 'cat') {
    return `
      <path d="M58 70 L64 30 L92 50 Z" fill="${c.body}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M66 58 L69 40 L82 50 Z" fill="${c.inner}"/>
      <path d="M142 70 L136 30 L108 50 Z" fill="${c.body}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M134 58 L131 40 L118 50 Z" fill="${c.inner}"/>`;
  }
  // 병아리: 머리 위 깃털 세 가닥
  return `
    <path d="M92 42 Q90 28 98 24" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 40 Q102 24 110 22" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M106 44 Q114 34 120 34" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
}

function face(kind, mood, c) {
  const eyes = mood === 'happy'
    ? `<path d="M74 92 Q82 82 90 92" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
       <path d="M110 92 Q118 82 126 92" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="82" cy="90" r="6.5" fill="${INK}"/><circle cx="84.5" cy="87.5" r="2" fill="#fff"/>
       <circle cx="118" cy="90" r="6.5" fill="${INK}"/><circle cx="120.5" cy="87.5" r="2" fill="#fff"/>`;
  const blush = `<ellipse cx="68" cy="104" rx="9" ry="5" fill="#ff9fa8" opacity="0.6"/>
    <ellipse cx="132" cy="104" rx="9" ry="5" fill="#ff9fa8" opacity="0.6"/>`;
  let mouth;
  if (kind === 'chick') {
    mouth = `<path d="M93 100 L107 100 L100 109 Z" fill="#ff9d3a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else if (kind === 'bear') {
    mouth = `<ellipse cx="100" cy="106" rx="19" ry="13" fill="${c.inner}" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="100" cy="100" rx="6" ry="4.5" fill="${INK}"/>
      ${mood === 'happy' ? `<path d="M93 108 Q100 117 107 108" fill="#e86a6a" stroke="${INK}" stroke-width="2.5"/>`
        : `<path d="M94 108 Q100 113 106 108" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`}`;
  } else {
    mouth = mood === 'happy'
      ? `<path d="M92 104 Q100 115 108 104 Z" fill="#e86a6a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`
      : `<path d="M92 104 Q96 109 100 104 Q104 109 108 104" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  const whiskers = kind === 'cat'
    ? `<path d="M56 98 L72 100 M56 106 L72 105 M144 98 L128 100 M144 106 L128 105" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
    : '';
  return eyes + blush + mouth + whiskers;
}

function flower(cx, cy, r, petal = '#ffb6c8') {
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const x = cx + Math.cos((a * Math.PI) / 180) * r;
    const y = cy + Math.sin((a * Math.PI) / 180) * r;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r * 0.85}" fill="${petal}" stroke="${INK}" stroke-width="1.5"/>`;
  }).join('');
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="#ffd75e" stroke="${INK}" stroke-width="1.5"/>`;
}

function accessories(form) {
  let s = '';
  if (form >= 1 && form < 4) {   // 새싹
    s += `<path d="M100 40 Q98 26 100 16" fill="none" stroke="#4f9a3f" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 22 Q88 10 80 18 Q90 28 100 22 Z" fill="#8fd06f" stroke="#4f9a3f" stroke-width="2"/>
      <path d="M100 20 Q112 6 121 13 Q112 25 100 20 Z" fill="#8fd06f" stroke="#4f9a3f" stroke-width="2"/>`;
  }
  if (form >= 2) {               // 목도리
    s += `<path d="M58 126 Q100 142 142 126 L142 138 Q100 154 58 138 Z" fill="#f08a8a" stroke="${INK}" stroke-width="2.5"/>
      <path d="M124 138 L132 166 L118 164 L114 140 Z" fill="#f08a8a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  if (form === 3) s += flower(140, 62, 7);   // 귀 옆 꽃
  if (form >= 4) {               // 꽃왕관과 반짝이
    s += [[66, 52, '#ffb6c8'], [83, 42, '#ffd1a1'], [100, 38, '#c9b6ff'], [117, 42, '#ffd1a1'], [134, 52, '#ffb6c8']]
      .map(([x, y, col]) => flower(x, y, 6, col)).join('');
    s += [[30, 60], [170, 70], [40, 150], [165, 140]]
      .map(([x, y]) => `<path d="M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z" fill="#ffd75e" stroke="${INK}" stroke-width="1.5"/>`)
      .join('');
  }
  return s;
}

function heart(x, y, s, fill = '#ff7b8f') {
  return `<path d="M${x} ${y + 6 * s} C${x - 12 * s} ${y - 4 * s} ${x - 6 * s} ${y - 12 * s} ${x} ${y - 5 * s}
    C${x + 6 * s} ${y - 12 * s} ${x + 12 * s} ${y - 4 * s} ${x} ${y + 6 * s} Z" fill="${fill}" stroke="${INK}" stroke-width="1.5"/>`;
}

export function petLabel(kind, form) {
  return `${PETS[kind] ?? '친구'}, ${FORMS[form]} 모습`;
}

// crop: 작은 모습일 때 그림 위쪽 빈 곳을 잘라서 화면을 덜 차지하게 한다 (첫 화면용)
export function petSvg({ kind, form = 0, scale = 1, mood = 'normal', size = 200, crop = false }) {
  const c = COLORS[kind] ?? COLORS.bunny;
  const arms = kind === 'chick'
    ? `<path d="M50 134 Q36 140 44 152 Q54 150 58 140 Z" fill="${c.inner}" stroke="${INK}" stroke-width="2.5"/>
       <path d="M150 134 Q164 140 156 152 Q146 150 142 140 Z" fill="${c.inner}" stroke="${INK}" stroke-width="2.5"/>`
    : `<ellipse cx="56" cy="142" rx="10" ry="15" transform="rotate(${mood === 'happy' ? 40 : 20} 56 142)" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
       <ellipse cx="144" cy="142" rx="10" ry="15" transform="rotate(${mood === 'happy' ? -40 : -20} 144 142)" fill="${c.body}" stroke="${INK}" stroke-width="3"/>`;
  const extra = mood === 'happy' ? heart(36, 40, 1) + heart(166, 34, 0.8)
    : mood === 'cheer' ? heart(100, 150, 1.3) : '';
  const top = crop ? Math.max(0, Math.round(190 - 190 * scale)) : 0;
  const h = 200 - top;
  return `<svg class="pet pet-${mood}" viewBox="0 ${top} 200 ${h}" width="${size}" height="${Math.round((size * h) / 200)}" role="img" aria-label="${petLabel(kind, form)}">
    <ellipse cx="100" cy="190" rx="${48 * scale}" ry="7" fill="#000" opacity="0.08"/>
    <g transform="translate(100 190) scale(${scale.toFixed(3)}) translate(-100 -190)">
      <g class="pet-body">
        <ellipse cx="78" cy="180" rx="15" ry="9" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="122" cy="180" rx="15" ry="9" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="100" cy="146" rx="50" ry="38" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="100" cy="152" rx="30" ry="24" fill="${c.belly}"/>
        ${arms}
        ${ears(kind, c)}
        <circle cx="100" cy="92" r="50" fill="${c.body}" stroke="${INK}" stroke-width="3"/>
        ${face(kind, mood, c)}
        ${accessories(form)}
        ${extra}
      </g>
    </g>
  </svg>`;
}

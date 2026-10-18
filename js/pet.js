// 함께 자라는 친구 그림 (SVG). 이 앱을 위해 단순한 동그라미 모양으로 직접 그린 동물들이다.
// 머리는 크고 몸은 작게, 큰 눈과 반짝이는 하이라이트, 연한 볼터치.
// form: 0 아기, 1 새싹, 2 목도리, 3 꽃, 4 꽃왕관(목표 도착) / scale: 단계마다 조금씩 커진다
// mood: 'normal'(숨 쉬기·눈 깜빡임) | 'happy'(다 먹은 날·자란 날: ^^ 눈, 벌린 입, 든 팔, 하트)
//       | 'cheer'(몸무게가 줄어든 날: 힘준 눈썹, 두 손으로 든 하트)
// 움직임은 app.css 의 .pet-* 애니메이션이 맡고, 기기의 '동작 줄이기'를 켜면 멈춘다.
import { PETS, FORMS } from './grow.js';

const INK = '#6b5040';
const EYE = '#3d2b24';
const COLORS = {
  bunny: { body: '#fff3f6', belly: '#ffffff', inner: '#ffcadb', nose: '#ff9fb5' },
  chick: { body: '#fff1a6', belly: '#fff9d9', inner: '#ffe07a', nose: '#ffb067' },
  bear: { body: '#f1cfad', belly: '#fbe6d2', inner: '#f8d9c0', nose: '#6b4a3a' },
  cat: { body: '#e1e9f6', belly: '#f7f9fd', inner: '#ffcadb', nose: '#ff9fb5' },
};
const line = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

function ears(kind, c) {
  if (kind === 'bunny') {
    return `
      <ellipse cx="76" cy="32" rx="13" ry="27" transform="rotate(-14 76 32)" fill="${c.body}" ${line()}/>
      <ellipse cx="76" cy="35" rx="6" ry="17" transform="rotate(-14 76 35)" fill="${c.inner}"/>
      <ellipse cx="124" cy="32" rx="13" ry="27" transform="rotate(14 124 32)" fill="${c.body}" ${line()}/>
      <ellipse cx="124" cy="35" rx="6" ry="17" transform="rotate(14 124 35)" fill="${c.inner}"/>`;
  }
  if (kind === 'bear') {
    return `
      <circle cx="52" cy="54" r="18" fill="${c.body}" ${line()}/><circle cx="52" cy="54" r="9" fill="${c.inner}"/>
      <circle cx="148" cy="54" r="18" fill="${c.body}" ${line()}/><circle cx="148" cy="54" r="9" fill="${c.inner}"/>`;
  }
  if (kind === 'cat') {
    return `
      <path d="M48 80 L54 30 L90 52 Z" fill="${c.body}" ${line()}/><path d="M57 66 L60 42 L80 54 Z" fill="${c.inner}"/>
      <path d="M152 80 L146 30 L110 52 Z" fill="${c.body}" ${line()}/><path d="M143 66 L140 42 L120 54 Z" fill="${c.inner}"/>`;
  }
  // 병아리: 머리 위 깃털 세 가닥
  return `
    <path d="M92 44 Q88 30 96 24" fill="none" ${line()}/>
    <path d="M100 42 Q101 26 110 21" fill="none" ${line()}/>
    <path d="M108 45 Q116 34 124 34" fill="none" ${line()}/>`;
}

// 동그란 큰 눈 (반짝이는 하이라이트 두 개). 깜빡임은 .pet-eye 에 움직임을 준다.
function roundEye(cx, cy) {
  return `<g class="pet-eye"><circle cx="${cx}" cy="${cy}" r="11" fill="${EYE}"/>
    <circle cx="${cx + 3.6}" cy="${cy - 4}" r="4.2" fill="#fff"/><circle cx="${cx - 3.8}" cy="${cy + 4.2}" r="1.8" fill="#fff"/></g>`;
}

function face(kind, mood, c) {
  let eyes;
  if (mood === 'happy') {  // 기쁨: 웃느라 감은 ^ ^ 눈
    eyes = `<path d="M64 103 Q76 88 88 103" fill="none" stroke="${EYE}" stroke-width="5" stroke-linecap="round"/>
      <path d="M112 103 Q124 88 136 103" fill="none" stroke="${EYE}" stroke-width="5" stroke-linecap="round"/>`;
  } else {
    eyes = roundEye(76, 100) + roundEye(124, 100);
  }
  // 응원: 안쪽이 살짝 올라간 힘준 눈썹
  const brows = mood === 'cheer'
    ? `<g class="pet-brows"><path d="M63 82 Q72 76 85 80" fill="none" stroke="${EYE}" stroke-width="3.5" stroke-linecap="round"/>
       <path d="M137 82 Q128 76 115 80" fill="none" stroke="${EYE}" stroke-width="3.5" stroke-linecap="round"/></g>`
    : '';
  const blushOpacity = mood === 'happy' ? 0.85 : 0.6;
  const blush = `<ellipse cx="58" cy="119" rx="12" ry="7" fill="#ffb3c4" opacity="${blushOpacity}"/>
    <ellipse cx="142" cy="119" rx="12" ry="7" fill="#ffb3c4" opacity="${blushOpacity}"/>`;

  let mouth;
  if (kind === 'chick') {
    mouth = mood === 'happy'
      ? `<path d="M90 112 L110 112 L100 120 Z" fill="${c.nose}" ${line(2.5)}/><path d="M92 121 L108 121 L100 128 Z" fill="${c.nose}" ${line(2.5)}/>`
      : `<path d="M91 113 L109 113 L100 123 Z" fill="${c.nose}" ${line(2.5)}/>`;
  } else {
    const nose = kind === 'bear'
      ? `<ellipse cx="100" cy="122" rx="21" ry="15" fill="${c.belly}" ${line(2.5)}/><ellipse cx="100" cy="115" rx="7" ry="5" fill="${c.nose}"/>`
      : `<ellipse cx="100" cy="112" rx="4" ry="3" fill="${c.nose}"/>`;
    const y = kind === 'bear' ? 121 : 117;
    if (mood === 'happy') {
      mouth = `<path d="M88 ${y} Q100 ${y + 18} 112 ${y} Z" fill="#ff8f9c" ${line(2.5)}/><ellipse cx="100" cy="${y + 9}" rx="5" ry="3.5" fill="#ffc2ca"/>`;
    } else if (mood === 'cheer') {
      mouth = `<path d="M90 ${y} Q100 ${y + 10} 110 ${y}" fill="none" ${line(3)}/>`;
    } else {
      mouth = `<path d="M92 ${y} Q96 ${y + 5} 100 ${y} Q104 ${y + 5} 108 ${y}" fill="none" ${line(2.5)}/>`;
    }
    mouth = nose + mouth;
  }
  const whiskers = kind === 'cat'
    ? `<path d="M40 112 L54 114 M40 121 L54 120 M160 112 L146 114 M160 121 L146 120" ${line(2)}/>`
    : '';
  return blush + brows + `<g class="pet-eyes">${eyes}</g>` + mouth + whiskers;
}

function flower(cx, cy, r, petal = '#ffbfd0') {
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const x = cx + Math.cos((a * Math.PI) / 180) * r;
    const y = cy + Math.sin((a * Math.PI) / 180) * r;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r * 0.85}" fill="${petal}" stroke="${INK}" stroke-width="1.5"/>`;
  }).join('');
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="#ffd96b" stroke="${INK}" stroke-width="1.5"/>`;
}

function sparkle(x, y, s = 1) {
  return `<path d="M${x} ${y - 9 * s} L${x + 3 * s} ${y - 3 * s} L${x + 9 * s} ${y} L${x + 3 * s} ${y + 3 * s} L${x} ${y + 9 * s} L${x - 3 * s} ${y + 3 * s} L${x - 9 * s} ${y} L${x - 3 * s} ${y - 3 * s} Z" fill="#ffd96b" stroke="${INK}" stroke-width="1.5"/>`;
}

function heart(x, y, s, fill = '#ff8fa3') {
  return `<path d="M${x} ${y + 6 * s} C${x - 12 * s} ${y - 4 * s} ${x - 6 * s} ${y - 12 * s} ${x} ${y - 5 * s}
    C${x + 6 * s} ${y - 12 * s} ${x + 12 * s} ${y - 4 * s} ${x} ${y + 6 * s} Z" fill="${fill}" stroke="${INK}" stroke-width="1.8"/>`;
}

function headTop(form) {
  let s = '';
  if (form >= 1 && form < 4) {   // 새싹
    s += `<path d="M100 44 Q98 32 100 22" fill="none" stroke="#4f9a3f" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 28 Q88 15 79 23 Q90 34 100 28 Z" fill="#9bd77d" stroke="#4f9a3f" stroke-width="2"/>
      <path d="M100 26 Q112 11 122 18 Q113 31 100 26 Z" fill="#9bd77d" stroke="#4f9a3f" stroke-width="2"/>`;
  }
  if (form === 3) s += flower(146, 62, 7);            // 귀 옆 꽃
  if (form >= 4) {                                     // 꽃왕관
    s += [[62, 60, '#ffbfd0'], [79, 47, '#ffd6ad'], [100, 42, '#d4c4ff'], [121, 47, '#ffd6ad'], [138, 60, '#ffbfd0']]
      .map(([x, y, col]) => flower(x, y, 6.5, col)).join('');
  }
  return s;
}

function scarf(form) {
  if (form < 2) return '';
  return `<path d="M62 140 Q100 157 138 140 L139 151 Q100 168 61 151 Z" fill="#f59a9a" ${line(2.5)}/>
    <path d="M118 152 L126 176 L112 174 L108 154 Z" fill="#f59a9a" ${line(2.5)}/>`;
}

function arms(kind, mood, c) {
  const fill = kind === 'chick' ? c.inner : c.body;
  if (mood === 'happy') {   // 신나서 두 팔을 번쩍
    return `<ellipse cx="62" cy="142" rx="9" ry="14" transform="rotate(40 62 142)" fill="${fill}" ${line()}/>
      <ellipse cx="138" cy="142" rx="9" ry="14" transform="rotate(-40 138 142)" fill="${fill}" ${line()}/>`;
  }
  if (mood === 'cheer') {   // 두 손을 모아 하트를 든 모습 (하트는 앞에 따로 그림)
    return `<ellipse cx="84" cy="160" rx="9" ry="12" transform="rotate(-35 84 160)" fill="${fill}" ${line()}/>
      <ellipse cx="116" cy="160" rx="9" ry="12" transform="rotate(35 116 160)" fill="${fill}" ${line()}/>`;
  }
  return `<ellipse cx="66" cy="160" rx="9" ry="13" transform="rotate(25 66 160)" fill="${fill}" ${line()}/>
    <ellipse cx="134" cy="160" rx="9" ry="13" transform="rotate(-25 134 160)" fill="${fill}" ${line()}/>`;
}

export function petLabel(kind, form, name = '') {
  const who = name ? `${name}(${PETS[kind] ?? '친구'})` : (PETS[kind] ?? '친구');
  return `${who}, ${FORMS[form]} 모습`;
}

// crop: 작은 모습일 때 그림 위쪽 빈 곳을 잘라서 화면을 덜 차지하게 한다 (첫 화면용)
export function petSvg({ kind, form = 0, scale = 1, mood = 'normal', size = 200, crop = false, name = '' }) {
  const c = COLORS[kind] ?? COLORS.bunny;
  const top = crop ? Math.max(0, Math.round(190 - 190 * scale)) : 0;
  const h = 200 - top;
  const final = form >= 4;
  const around = [
    final ? sparkle(26, 72) + sparkle(174, 80) + sparkle(30, 150, 0.8) + sparkle(170, 146, 0.8) : '',
    mood === 'happy' ? heart(30, 44, 0.9) + heart(170, 36, 0.75) : '',
  ].join('');
  return `<svg class="pet pet-${mood} pet-${kind}" viewBox="0 ${top} 200 ${h}" width="${size}" height="${Math.round((size * h) / 200)}" role="img" aria-label="${petLabel(kind, form, name)}">
    <ellipse cx="100" cy="191" rx="${(42 * scale).toFixed(1)}" ry="6" fill="#000" opacity="0.08"/>
    <g transform="translate(100 190) scale(${scale.toFixed(3)}) translate(-100 -190)">
      <g class="pet-move">
        <ellipse cx="83" cy="182" rx="13" ry="8" fill="${c.body}" ${line()}/>
        <ellipse cx="117" cy="182" rx="13" ry="8" fill="${c.body}" ${line()}/>
        <ellipse cx="100" cy="160" rx="38" ry="28" fill="${c.body}" ${line()}/>
        <ellipse cx="100" cy="165" rx="22" ry="16" fill="${c.belly}"/>
        ${mood === 'cheer' ? '' : arms(kind, mood, c)}
        ${ears(kind, c)}
        <ellipse cx="100" cy="96" rx="60" ry="54" fill="${c.body}" ${line()}/>
        ${kind === 'cat' ? `<path d="M90 48 L92 60 M100 46 L100 60 M110 48 L108 60" stroke="#c5d3ea" stroke-width="4" stroke-linecap="round"/>` : ''}
        ${face(kind, mood, c)}
        ${headTop(form)}
        ${scarf(form)}
        ${mood === 'cheer' ? arms(kind, mood, c) + heart(100, 158, 1.5) : ''}
        ${around}
      </g>
    </g>
  </svg>`;
}

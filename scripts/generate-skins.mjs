// Génère les 6 skins des personnages (SVG, 200×260) dans public/skins : node scripts/generate-skins.mjs
// Chaque espèce illustre l'avantage du personnage :
//   Inès  astronaute humaine (Sang-froid : +3 min)        Léo   félin (Sprinteur : +20 % de vitesse)
//   Nova  être bioluminescent (Économe : lampe -35 %)     Kenji androïde (Décodeur : pénalités ÷2)
//   Sam   saurien du désert (Endurant : boit 40 % moins)  Maya  être végétal (Souffle long : O₂ -25 %)
import { mkdirSync, writeFileSync } from 'node:fs'

const INK = '#141033'
const line = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
const DEFS = `<defs>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<radialGradient id="round" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".36"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#6ff5e4" stop-opacity=".75"/><stop offset=".55" stop-color="#2be0cc" stop-opacity=".22"/><stop offset="1" stop-color="#2be0cc" stop-opacity="0"/></radialGradient>
<linearGradient id="visor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".4" stop-color="#e0a52f"/><stop offset="1" stop-color="#5c3a10"/></linearGradient>
</defs>`

/** forme ombrée : la couleur de base, puis un voile de volume */
const rr = (x, y, w, h, r, fill, sh = 'shade') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${line}/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${sh})"/>`
const ell = (cx, cy, rx, ry, fill, sh = 'round') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${line}/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${sh})"/>`
const path = (d, fill, sh) => `<path d="${d}" fill="${fill}" ${line}/>` + (sh ? `<path d="${d}" fill="url(#${sh})"/>` : '')
const stroke = (d, c, w = 3) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

/** corps commun : jambes, bottes, torse, bras et mains (les têtes et détails changent) */
function body({ suit, suit2, boot, sole, hand, cuff, chest = '', extraBack = '', belt, neck }) {
  return `<ellipse cx="100" cy="250" rx="56" ry="7" fill="#000" opacity=".3"/>
${extraBack}
${rr(68, 180, 27, 58, 12, suit, 'side')}${rr(105, 180, 27, 58, 12, suit, 'side')}
${rr(63, 226, 34, 20, 8, boot)}${rr(103, 226, 34, 20, 8, boot)}
<rect x="63" y="241" width="34" height="6" rx="3" fill="${sole}"/><rect x="103" y="241" width="34" height="6" rx="3" fill="${sole}"/>
${path('M43 124 C33 136 29 158 33 176 L50 178 C50 160 54 146 62 136 Z', suit, 'side')}
${path('M157 124 C167 136 171 158 167 176 L150 178 C150 160 146 146 138 136 Z', suit, 'side')}
<rect x="30" y="170" width="23" height="9" rx="4" fill="${cuff}" ${line}/><rect x="147" y="170" width="23" height="9" rx="4" fill="${cuff}" ${line}/>
${ell(41, 188, 12, 12, hand)}${ell(159, 188, 12, 12, hand)}
${neck ? rr(84, 94, 32, 24, 8, neck) : ''}
${path('M58 122 Q100 104 142 122 L138 190 Q100 200 62 190 Z', suit)}
${path('M58 122 Q100 104 142 122 L138 190 Q100 200 62 190 Z', 'none', 'shade')}
<rect x="62" y="176" width="76" height="13" rx="4" fill="${belt ?? suit2}" ${line}/>
${chest}`
}

const skins = {
  // ——— Inès : astronaute humaine, commandante. Montre de mission au poignet : le temps gagné. ———
  ines: () => {
    const suit = '#EDEFF5'
    return `${body({
      suit, suit2: '#3D7BFF', boot: '#5B6786', sole: '#232845', hand: '#D8DCE8', cuff: '#3D7BFF', belt: '#3D7BFF',
      extraBack: rr(48, 106, 104, 76, 14, '#AEB6CB'),
      chest: `<rect x="75" y="134" width="50" height="33" rx="7" fill="#2A3155" ${line}/>
<circle cx="88" cy="146" r="4.2" fill="#E8B93C"/><circle cx="100" cy="146" r="4.2" fill="#FF6B4A"/><circle cx="112" cy="146" r="4.2" fill="#46E0A0"/>
<rect x="83" y="155" width="34" height="5" rx="2.5" fill="#7FA5FF"/>
<path d="M66 124 l5 -3 1 6z" fill="#E8B93C"/>
<rect x="123" y="122" width="13" height="9" rx="1.5" fill="#3D7BFF" stroke="${INK}" stroke-width="1.6"/>
<circle cx="159" cy="165" r="9" fill="#F7E7B5" ${line}/><path d="M159 160v5l3.5 2.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    })}
${rr(72, 96, 56, 22, 10, '#C7CDDD')}
${ell(100, 58, 50, 50, suit)}
<path d="M61 56 Q61 26 100 26 Q139 26 139 56 Q139 88 100 88 Q61 88 61 56Z" fill="url(#visor)" ${line}/>
<path d="M72 50 Q78 34 100 33" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>
<circle cx="120" cy="72" r="5" fill="#fff" opacity=".35"/>
<rect x="44" y="48" width="12" height="24" rx="5" fill="#3D7BFF" ${line}/><rect x="144" y="48" width="12" height="24" rx="5" fill="#3D7BFF" ${line}/>
<rect x="90" y="4" width="20" height="9" rx="4" fill="#E8B93C" ${line}/>`
  },

  // ——— Léo : félin humanoïde, combinaison légère de sprint, éclair et baskets. ———
  leo: () => {
    const fur = '#F2823A'
    return `${body({
      suit: '#2B3163', suit2: '#F5C542', neck: '#F2823A', boot: '#FFFFFF', sole: '#F2643A', hand: '#FFE3C2', cuff: '#F5C542', belt: '#F5C542',
      extraBack: stroke('M138 196 C176 206 188 176 172 154 C166 146 160 148 160 156', INK, 13) + stroke('M138 196 C176 206 188 176 172 154 C166 146 160 148 160 156', fur, 8) + stroke('M170 193l-5 -8M180 178l-8 -3', INK, 3),
      chest: `<path d="M106 126 L86 158 H100 L92 180 L118 144 H103 L114 126Z" fill="#F5C542" ${line}/>
<path d="M63 145 l10 3 M63 158 l10 2 M137 145 l-10 3 M137 158 l-10 2" stroke="#F2643A" stroke-width="4" stroke-linecap="round"/>`,
    })}
<path d="M60 40 L52 4 L88 22Z" fill="${fur}" ${line}/><path d="M63 31 L59 14 L78 24Z" fill="#FFB9A0"/>
<path d="M140 40 L148 4 L112 22Z" fill="${fur}" ${line}/><path d="M137 31 L141 14 L122 24Z" fill="#FFB9A0"/>
${ell(100, 62, 50, 46, fur)}
<path d="M90 17 l3 15 M100 15 v17 M110 17 l-3 15 M52 56 l13 3 M54 72 l12 -1 M148 56 l-13 3 M146 72 l-12 -1" stroke="#B9451B" stroke-width="4.5" stroke-linecap="round"/>
<ellipse cx="100" cy="82" rx="27" ry="20" fill="#FFE9D2"/>
<ellipse cx="80" cy="58" rx="11" ry="12" fill="#FFF7DF" ${line}/><ellipse cx="120" cy="58" rx="11" ry="12" fill="#FFF7DF" ${line}/>
<ellipse cx="81" cy="59" rx="4.5" ry="9.5" fill="${INK}"/><ellipse cx="119" cy="59" rx="4.5" ry="9.5" fill="${INK}"/>
<circle cx="79.5" cy="54" r="2.2" fill="#fff"/><circle cx="117.5" cy="54" r="2.2" fill="#fff"/>
<path d="M93 73 h14 l-7 8z" fill="#E25B5B" ${line}/>
${stroke('M100 81 v5 M100 86 q-7 7 -14 2 M100 86 q7 7 14 2', INK, 2.6)}
${stroke('M72 82 L42 76 M73 89 L44 92 M128 82 L158 76 M127 89 L156 92', INK, 2)}
<rect x="60" y="26" width="80" height="11" rx="5" fill="#2B3163" ${line}/>
<rect x="76" y="22" width="20" height="16" rx="6" fill="#7FE3FF" ${line}/><rect x="104" y="22" width="20" height="16" rx="6" fill="#7FE3FF" ${line}/>`
  },

  // ——— Nova : être bioluminescent, sa propre lumière lui sert de lampe. ———
  nova: () => {
    const skin = '#37D6C4'
    return `<circle cx="100" cy="60" r="92" fill="url(#glow)"/>${body({
      suit: '#12395A', suit2: '#1FB5A8', neck: skin, boot: '#0D2A45', sole: '#FF7A6B', hand: skin, cuff: '#FF7A6B', belt: '#1FB5A8',
      chest: `<circle cx="100" cy="146" r="17" fill="#0D2A45" ${line}/><circle cx="100" cy="146" r="12" fill="#6FF5E4"/><circle cx="100" cy="146" r="6" fill="#fff"/>
${stroke('M100 163 V176 M83 146 H66 M117 146 H134', '#6FF5E4', 3)}`,
    })}
${stroke('M78 22 C70 8 60 6 50 12', INK, 7)}${stroke('M78 22 C70 8 60 6 50 12', skin, 3.5)}
${stroke('M122 22 C130 8 140 6 150 12', INK, 7)}${stroke('M122 22 C130 8 140 6 150 12', skin, 3.5)}
<circle cx="48" cy="13" r="12" fill="url(#glow)"/><circle cx="152" cy="13" r="12" fill="url(#glow)"/>
<circle cx="48" cy="13" r="6.5" fill="#FFF8C9" ${line}/><circle cx="152" cy="13" r="6.5" fill="#FFF8C9" ${line}/>
${path('M50 58 C30 50 22 62 22 76 C34 76 46 74 54 68Z', '#23B8AA')}${path('M150 58 C170 50 178 62 178 76 C166 76 154 74 146 68Z', '#23B8AA')}
<path d="M54 54 C54 24 76 16 100 16 C124 16 146 24 146 54 C146 86 124 108 100 108 C76 108 54 86 54 54Z" fill="${skin}" ${line}/>
<path d="M54 54 C54 24 76 16 100 16 C124 16 146 24 146 54 C146 86 124 108 100 108 C76 108 54 86 54 54Z" fill="url(#round)"/>
<ellipse cx="78" cy="58" rx="15" ry="18" fill="#08223A" ${line} transform="rotate(-8 78 58)"/><ellipse cx="122" cy="58" rx="15" ry="18" fill="#08223A" ${line} transform="rotate(8 122 58)"/>
<ellipse cx="78" cy="59" rx="8" ry="11" fill="#6FF5E4"/><ellipse cx="122" cy="59" rx="8" ry="11" fill="#6FF5E4"/><circle cx="74" cy="52" r="3.6" fill="#fff"/><circle cx="118" cy="52" r="3.6" fill="#fff"/>
<path d="M90 90 q10 7 20 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
<circle cx="100" cy="30" r="5" fill="#FFF8C9"/><circle cx="86" cy="34" r="3" fill="#FFF8C9"/><circle cx="114" cy="34" r="3" fill="#FFF8C9"/><circle cx="62" cy="78" r="2.6" fill="#FFF8C9"/><circle cx="138" cy="78" r="2.6" fill="#FFF8C9"/><circle cx="70" cy="86" r="2" fill="#FFF8C9"/><circle cx="130" cy="86" r="2" fill="#FFF8C9"/>`
  },

  // ——— Kenji : androïde décodeur, tête-écran et circuits. ———
  kenji: () => {
    const m = '#8A70FF'
    return `${body({
      suit: '#3A3370', suit2: '#7B5CFF', boot: '#2A2558', sole: '#3FD8F0', hand: '#C7CEE8', cuff: '#3FD8F0', belt: '#7B5CFF',
      chest: `<rect x="72" y="128" width="56" height="42" rx="6" fill="#0B1030" ${line}/>
<text x="100" y="146" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle" fill="#3FD8F0">01101</text>
<text x="100" y="161" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle" fill="#7B5CFF">&gt;_OK</text>`,
    })}
${rr(88, 96, 24, 14, 3, '#C7CEE8')}
${stroke('M100 18 V6', INK, 5)}<circle cx="100" cy="6" r="5" fill="#3FD8F0" ${line}/>
${rr(38, 42, 14, 36, 5, '#5C4FC0')}${rr(148, 42, 14, 36, 5, '#5C4FC0')}
<circle cx="45" cy="60" r="3.5" fill="#3FD8F0"/><circle cx="155" cy="60" r="3.5" fill="#3FD8F0"/>
<path d="M60 16 H140 L152 34 V84 L136 104 H64 L48 84 V34Z" fill="${m}" ${line}/>
<path d="M60 16 H140 L152 34 V84 L136 104 H64 L48 84 V34Z" fill="url(#round)"/>
<rect x="58" y="42" width="84" height="30" rx="9" fill="#0B1030" ${line}/>
<rect x="68" y="50" width="26" height="14" rx="4" fill="#3FD8F0"/><rect x="106" y="50" width="26" height="14" rx="4" fill="#3FD8F0"/>
<rect x="74" y="55" width="14" height="4" fill="#0B1030"/><rect x="112" y="55" width="14" height="4" fill="#0B1030"/>
<rect x="76" y="82" width="48" height="11" rx="3" fill="#0B1030"/>
${stroke('M82 82 V93 M90 82 V93 M98 82 V93 M106 82 V93 M114 82 V93', '#3FD8F0', 2)}
${stroke('M64 30 H82 L88 36 M136 30 H118 L112 36', '#D8CFFF', 2.5)}`
  },

  // ——— Sam : saurien du désert, médecin. Reptile économe en eau, gourde et croix médicale. ———
  sam: () => {
    const sk = '#C9A15B'
    return `${body({
      suit: '#E9EDF5', suit2: '#FF5C8A', neck: sk, boot: '#6D7892', sole: '#FF5C8A', hand: sk, cuff: '#FF5C8A', belt: '#59657F',
      extraBack: stroke('M62 190 C24 200 12 222 28 238 C34 244 44 240 44 232', INK, 19) + stroke('M62 190 C24 200 12 222 28 238 C34 244 44 240 44 232', sk, 13),
      chest: `<path d="M100 112 L84 122 L90 174 H110 L116 122Z" fill="#FFFFFF" opacity=".55"/>
<rect x="86" y="130" width="28" height="28" rx="6" fill="#fff" ${line}/><path d="M96 134h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#FF5C8A"/>
<rect x="116" y="162" width="17" height="26" rx="6" fill="#4FB7E8" ${line}/><rect x="120" y="157" width="9" height="6" rx="2" fill="#E9EDF5" ${line}/>`,
    })}
<path d="M60 44 L40 26 L58 28 L52 8 L72 22 L78 2 L92 18 L100 -1 L108 18 L122 2 L128 22 L148 8 L142 28 L160 26 L140 44Z" fill="#FF5C8A" ${line}/>
${ell(100, 56, 46, 42, sk)}
${path('M60 72 C60 58 140 58 140 72 C142 92 124 108 100 108 C76 108 58 92 60 72Z', '#DDBB7B')}
${path('M60 72 C60 58 140 58 140 72 C142 92 124 108 100 108 C76 108 58 92 60 72Z', 'none', 'round')}
<path d="M64 86 Q100 100 136 86" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
<path d="M74 88 l4 8 4 -6 M118 90 l4 6 4 -8" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
<circle cx="88" cy="72" r="2.5" fill="${INK}"/><circle cx="112" cy="72" r="2.5" fill="${INK}"/>
<circle cx="72" cy="46" r="15" fill="#F7E08A" ${line}/><circle cx="128" cy="46" r="15" fill="#F7E08A" ${line}/>
<ellipse cx="73" cy="47" rx="3.8" ry="12" fill="${INK}"/><ellipse cx="127" cy="47" rx="3.8" ry="12" fill="${INK}"/>
<path d="M56 38 Q72 26 88 36 M144 38 Q128 26 112 36" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<circle cx="95" cy="30" r="3" fill="#A87F3C"/><circle cx="105" cy="26" r="2.4" fill="#A87F3C"/><circle cx="100" cy="42" r="2.6" fill="#A87F3C"/>`
  },

  // ——— Maya : être végétal, ses feuilles produisent son oxygène. ———
  maya: () => {
    const sk = '#8FD14F'
    const leaf = (x, y, r, c = '#5FB02F', s = 1) =>
      `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0 C-13 -12 -13 -30 0 -44 C13 -30 13 -12 0 0Z" fill="${c}" ${line}/><path d="M0 -3 V-34" stroke="${INK}" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/></g>`
    return `${leaf(46, 44, -52, '#4F9E27')}${leaf(154, 44, 52, '#4F9E27')}${leaf(62, 26, -26)}${leaf(138, 26, 26)}${leaf(100, 20, 0, '#6FC238', 0.9)}
${body({
      suit: '#F4F7EC', suit2: '#9B5CFF', neck: sk, boot: '#4A3B7E', sole: '#9B5CFF', hand: sk, cuff: '#9B5CFF', belt: '#7E5FC2',
      extraBack: leaf(54, 170, -118, '#5FB02F', .8) + leaf(146, 170, 118, '#5FB02F', .8),
      chest: `<path d="M100 114 L82 124 L88 176 H112 L118 124Z" fill="${sk}" ${line}/>
${leaf(100, 165, 0, '#4F9E27', .55)}
<rect x="118" y="134" width="15" height="9" rx="2" fill="#E8E3FA" stroke="${INK}" stroke-width="2"/>
<path d="M122 134 V126 h7 V134" fill="#B9F06A" stroke="${INK}" stroke-width="2"/>
<circle cx="72" cy="140" r="6" fill="#B9F06A" stroke="${INK}" stroke-width="2"/><circle cx="72" cy="140" r="2" fill="#fff"/>`,
    })}
${ell(100, 62, 47, 45, sk)}
<path d="M58 40 Q100 8 142 40 Q128 34 112 36 Q104 26 94 36 Q74 32 58 40Z" fill="#5FB02F" ${line}/>
<ellipse cx="80" cy="62" rx="10" ry="13" fill="#fff" ${line}/><ellipse cx="120" cy="62" rx="10" ry="13" fill="#fff" ${line}/>
<circle cx="81" cy="64" r="6.5" fill="#6B3FD0"/><circle cx="119" cy="64" r="6.5" fill="#6B3FD0"/><circle cx="83" cy="61" r="2.4" fill="#fff"/><circle cx="121" cy="61" r="2.4" fill="#fff"/>
<ellipse cx="66" cy="78" rx="7" ry="4" fill="#E8A9D6" opacity=".7"/><ellipse cx="134" cy="78" rx="7" ry="4" fill="#E8A9D6" opacity=".7"/>
<path d="M90 86 q10 8 20 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(132 26)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="6" ry="9" fill="#B98CFF" ${line} transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#FFD84A" ${line}/></g>`
  },
}

mkdirSync('public/skins', { recursive: true })
for (const [id, draw] of Object.entries(skins)) {
  writeFileSync(`public/skins/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -26 216 286" width="216" height="286">${DEFS}${draw()}</svg>\n`)
}
console.log('skins écrits :', Object.keys(skins).join(', '))

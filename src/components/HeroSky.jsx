import { useEffect, useLayoutEffect, useRef } from 'react'
import styles from './HeroSky.module.css'

/*
 * A sky over the top half of the hero, set as a grid of small tiles in many
 * blues: each tile is tinted lighter or deeper in drifting patches (some
 * leaning cyan, some azure) and has a mark in the middle, like a sky printed
 * in halftone. Clouds are ASCII art drifting across: outlined in ( ) . _ '
 * and shaded in . : ; o 8, denser towards the base. The bottom of the sky
 * dissolves into the paper along a bank of round puffs. At night the tiles
 * turn to deep blues and a few stars twinkle.
 *
 * The pointer draws wind strokes over the tiles, orange while fresh, fading
 * to blue. A stroke that runs into a cloud tears it: the cells it passes get
 * blown along and then drift back into shape.
 *
 * The tiles are one 2D canvas on the CPU (willReadFrequently, like the
 * ticker). Every tile and glyph is drawn once into an atlas. A cell shows a
 * sprite (tile or glyph) with an optional stroke on top; each tick works out
 * what every cell should show and redraws only the cells that changed.
 *
 * Each cloud is its own small canvas, slid across by a linear transform
 * animation: it glides smoothly, pixel by pixel, on the compositor, and is
 * only redrawn while it's torn.
 */

const GLYPHS = [' ', '.', ':', ';', '-', '+', '*', 'o', '8', '(', ')', '~', '_', '/', '\\', '|', "'", ',']
const G = Object.fromEntries(GLYPHS.map((g, i) => [g, i]))
const TINTS = 7 // depth steps of the tiles
const HUES = 2 // azure and cyan
const TILE = GLYPHS.length // tiles come after the glyphs in the atlas: TILE + hue * TINTS + tint
const INK = 0
const ACCENT = 1
const BLUE = 2
const LEVELS = 15 // alpha steps; a cell is redrawn when what it shows changes
const TICK_MS = 33 // the sky steps at ~30fps: things move a whole cell at a time anyway
const WIND_S = 0.55 // time constant of a wind stroke fading out
const START_MS = 1100 // after the name has risen
const STILL_MS = 150 // no sky work until the page has stopped scrolling for this long
// most cells drawn in one tick: the first sky is typed out over a few frames
// instead of one long one, and a big gust can't hold up a frame either
const BUDGET = 1200
const PAD = 6 // room (in cells) around a cloud's canvas for cells blown out of place
const TEAR_R = 3.2 // how far from a stroke (in cells) cloud cells get blown
const STROKE = ['-', '\\', '|', '/']

// the tiles' colours: [pale tile, deep tile] and [faint mark, strong mark], per hue
const PALETTE = {
  light: {
    tile: [
      ['#e3eff8', '#7db8e6'],
      ['#dff3f7', '#74c3e0'],
    ],
    mark: [
      ['#b9d6ee', '#2c78c9'],
      ['#b5e0ec', '#1f8fbf'],
    ],
    stroke: '#2c6fbf',
  },
  dark: {
    tile: [
      ['#15254a', '#2b4f94'],
      ['#13294a', '#22558a'],
    ],
    mark: [
      ['#24396a', '#7fb0f0'],
      ['#1f3f66', '#6ec3e6'],
    ],
    stroke: '#8fbcf5',
  },
}

// seeded, so the sky and clouds are the same on every visit
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Value noise on a lattice `size` cells apart: soft blobs for the patches */
function noise(x, y, size, seed) {
  const gx = x / size
  const gy = y / size
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const v = (i, j) => hash(i + seed * 101, j - seed * 57)
  const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
  const bottom = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
  return top + (bottom - top) * sy
}

/** '#rrggbb' a..b at t */
function mix(a, b, t) {
  const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)
  const ch = (i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`
}

const strokeFor = (dx, dy) => G[STROKE[Math.round((((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180) / 45) % 4]]

/**
 * A cumulus in ASCII: round puffs on a flat base with a tower or two on top.
 * Outlined in ( ) . _ ' and shaded in . : ; o 8, sparse near the lit top and
 * dense at the base. Each cell can be blown out of place (dx, dy) and springs back.
 */
function makeCloud(rand, w, cs) {
  const pxW = w * cs
  const n = 3 + Math.floor(rand() * 3)
  const puffs = []
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1)
    puffs.push({
      cx: pxW * (0.16 + 0.68 * t) + (rand() - 0.5) * cs * 1.5,
      r: pxW * (0.14 + 0.16 * Math.sin(Math.PI * t) + rand() * 0.06),
      lift: 0,
    })
  }
  for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
    const r = pxW * (0.13 + rand() * 0.07)
    puffs.push({ cx: pxW * (0.32 + rand() * 0.36), r, lift: r * (0.7 + rand() * 0.4) })
  }
  const top = Math.max(...puffs.map((p) => p.r + p.lift))
  const h = Math.ceil(top / cs) + 1
  const base = (h - 0.5) * cs
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false
    const px = (x + 0.5) * cs
    const py = (y + 0.5) * cs
    return puffs.some((p) => (px - p.cx) ** 2 + (py - base + p.lift) ** 2 <= p.r * p.r)
  }
  const pick = (list, r) => list[Math.floor(r * list.length)]
  const xs = []
  const ys = []
  const gs = []
  const as = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      const r = hash(x + w * 7, y + h * 13)
      const depth = y / (h - 1) // 0 at the top, 1 at the base
      let g = ' '
      let a = 0.85
      if (!inside(x - 1, y)) g = pick(['(', '(', ';', ')'], r)
      else if (!inside(x + 1, y)) g = pick([')', ')', ';', '('], r)
      else if (!inside(x, y - 1)) g = pick(['.', '_', "'", ',', '.'], r)
      else if (!inside(x, y + 1)) g = pick(['o', '8', '~', 'o', ')', ';'], r)
      else if (depth < 0.3) {
        // the lit top: mostly clear, a few specks
        if (r < 0.2) {
          g = pick(['.', "'", ':'], hash(y, x))
          a = 0.55
        }
      } else if (r < 0.35 + depth * 0.6) {
        // shading: light : near the middle, heavy o and 8 near the base
        const s = Math.min(0.999, (depth - 0.3) * 1.1 + hash(y, x + 3) * 0.3)
        g = pick(['.', ':', ':', ';', ';', 'o', 'o', '8', '8'], s)
        a = 0.7
      }
      xs.push(x)
      ys.push(y)
      gs.push(G[g])
      as.push(a)
    }
  }
  const len = xs.length
  return {
    w,
    h,
    len,
    xs,
    ys,
    gs,
    as,
    dx: new Float32Array(len),
    dy: new Float32Array(len),
    vx: new Float32Array(len),
    vy: new Float32Array(len),
    torn: false,
  }
}

function createSky({ wrap, canvas, layer, host, avoid, quiet, still }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rand = seeded(7)
  let dpr = 1
  let cs = 12 // cell size in CSS px (cells are square)
  let cP = 12 // and in device px
  let cols = 0
  let rows = 0
  let n = 0
  let origin = { x: 0, y: 0 } // the grid's top left, in page coordinates
  let atlas = null
  let paper = '#fff'
  let dark = false
  let remount = false // the grid changed: the clouds need new canvases and animations
  // the sky alone: tile sprite per cell, and how much sky there is in it
  // (0 below the cloud bank, 1 well above it)
  let bG, sky
  // next frame and current frame: sprite, its colour row and alpha, then the stroke on top
  let nG, nC, nA, nS, nSC, nSA
  let cG, cC, cQ, cS, cSC, cSQ
  let mask // fades the sky behind the text
  let wind // energy of the wind stroke in each cell
  let windG
  const gusts = new Set() // cells with wind in them
  let stars = []
  let clouds = []
  let raf = 0
  let last = 0
  let time = 0
  let lastScroll = -1e9
  let visible = false
  let pointer = null // last { x, y, t } over the hero, in grid pixels
  let ready = false
  let bootRaf = 0
  let cleanTimer = 0

  function makeAtlas() {
    const css = getComputedStyle(wrap)
    const pal = PALETTE[dark ? 'dark' : 'light']
    const colors = [css.getPropertyValue('--ink').trim(), css.getPropertyValue('--accent').trim(), pal.stroke]
    paper = css.getPropertyValue('--paper').trim()
    atlas = document.createElement('canvas')
    atlas.width = (GLYPHS.length + TINTS * HUES) * cP
    atlas.height = colors.length * cP
    const a = atlas.getContext('2d', { willReadFrequently: true })
    a.font = `600 ${Math.round(cs * 0.95 * dpr)}px ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace`
    a.textAlign = 'center'
    a.textBaseline = 'middle'
    colors.forEach((color, row) => {
      a.fillStyle = color
      GLYPHS.forEach((g, i) => a.fillText(g, (i + 0.5) * cP, (row + 0.5) * cP + dpr * 0.5))
    })
    // the wind's colours get their strokes as lines from edge to edge of the
    // cell instead of characters, so a trail reads as one continuous stroke
    a.lineWidth = Math.max(1.5, 1.7 * dpr)
    const lines = { '-': [0, 0.5, 1, 0.5], '|': [0.5, 0, 0.5, 1], '/': [0, 1, 1, 0], '\\': [0, 0, 1, 1] }
    ;[ACCENT, BLUE].forEach((row) => {
      a.strokeStyle = colors[row]
      Object.entries(lines).forEach(([g, [x0, y0, x1, y1]]) => {
        const x = G[g] * cP
        const y = row * cP
        a.clearRect(x, y, cP, cP)
        a.beginPath()
        a.moveTo(x + x0 * cP, y + y0 * cP)
        a.lineTo(x + x1 * cP, y + y1 * cP)
        a.stroke()
      })
    })
    // tiles (top row): a coloured square with a hairline gap around it and a
    // mark in the middle that grows from a dot to a small square as it deepens
    const gap = Math.max(1, Math.round(dpr))
    for (let h = 0; h < HUES; h++) {
      for (let k = 0; k < TINTS; k++) {
        const t = k / (TINTS - 1)
        const x = (TILE + h * TINTS + k) * cP
        a.fillStyle = mix(pal.tile[h][0], pal.tile[h][1], t)
        a.fillRect(x + gap, gap, cP - gap, cP - gap)
        const m = Math.max(1, Math.round((1.3 + 3 * t) * dpr))
        a.fillStyle = mix(pal.mark[h][0], pal.mark[h][1], t)
        a.fillRect(x + Math.round((cP + gap - m) / 2), Math.round((cP + gap - m) / 2), m, m)
      }
    }
  }

  /** The tiles, the cloud bank, the stars and the fade behind the text, for this size and theme */
  function paintScene() {
    const at = (x, y) => y * cols + x
    const box = wrap.getBoundingClientRect()

    // the bank: round puffs along the bottom of the canvas, a soft edge on top of them
    const r = seeded(19)
    const puffs = []
    for (let x = -4; x < cols + 4; x += 5 + Math.floor(r() * 9)) puffs.push({ x, r: rows * (0.1 + r() * 0.16) })
    const base = rows * 0.97
    const bank = Array.from({ length: cols }, (_, x) => {
      let lift = 0
      for (const p of puffs) {
        const dx = x - p.x
        if (Math.abs(dx) < p.r) lift = Math.max(lift, Math.sqrt(p.r * p.r - dx * dx))
      }
      return base - lift
    })

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = at(x, y)
        // fully sky until 6 rows above the bank, then it thins out into the paper
        const s = smooth(bank[x], bank[x] - 6, y)
        sky[i] = s
        // depth: two octaves of noise, deeper towards the top; hue: its own, slower noise
        const v =
          0.62 * noise(x, y, 14, 3) + 0.38 * noise(x, y, 5, 9) + 0.35 * (1 - y / rows) - 0.14 + (hash(x, y) - 0.5) * 0.16
        const k = Math.max(0, Math.min(TINTS - 1, Math.floor(v * TINTS * (0.5 + 0.5 * s))))
        const h = noise(x, y, 22, 5) + (hash(y, x) - 0.5) * 0.25 > 0.55 ? 1 : 0
        bG[i] = TILE + h * TINTS + k
      }
    }

    // the stars, at night
    stars = []
    if (dark) {
      const sr = seeded(31)
      const count = Math.round((cols * rows) / 90)
      for (let k = 0; k < count; k++) {
        const i = at(Math.floor(sr() * cols), Math.floor(sr() * rows * 0.75))
        stars.push({ i, a: 0.6 + sr() * 0.4, w: 0.6 + sr() * 1.6, ph: sr() * 6.3 })
      }
    }

    // fade the sky behind the text: almost out behind the intro, so the small
    // type stays easy to read, and partly behind the name
    mask.fill(1)
    const fade = (el, floor) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const a = { x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height }
      const pad = 12
      const soft = 56
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = (x + 0.5) * cs
          const py = (y + 0.5) * cs
          const ox = Math.max(a.x - pad - px, 0, px - (a.x + a.w + pad))
          const oy = Math.max(a.y - pad - py, 0, py - (a.y + a.h + pad))
          const i = at(x, y)
          mask[i] = Math.min(mask[i], floor + (1 - floor) * smooth(0, soft, Math.hypot(ox, oy)))
        }
      }
    }
    fade(avoid, 0.06)
    fade(quiet, 0.6)
  }

  function makeClouds() {
    clouds = []
    const total = Math.max(4, Math.round(cols / 17))
    const big = Math.max(2, Math.round(total * 0.4))
    for (let k = 0; k < total; k++) {
      const isBig = k < big
      const w = isBig ? 28 + Math.floor(rand() * 14) : 10 + Math.floor(rand() * 9)
      const c = makeCloud(rand, w, cs)
      Object.assign(c, {
        start: ((k + rand() * 0.6) / total) * (cols + w) - w, // left edge, in cells, when it appears
        // anywhere in the sky, bottoms above the bank
        y: Math.floor(rand() * Math.max(1, rows * 0.72 - c.h)),
        speed: (isBig ? 0.35 : 0.55) + rand() * 0.35, // cells per second
      })
      clouds.push(c)
    }
    // the small ones go first, the big ones pass in front
    clouds.reverse()
  }

  /** Where a cloud's left edge is now, in cells */
  const cloudX = (c) => {
    const p = c.anim?.effect.getComputedTiming().progress
    return p == null ? c.start : -c.w + p * (cols + c.w)
  }

  /** A canvas per cloud, slid from just off the left edge to past the right one, forever */
  function mountClouds() {
    unmountClouds()
    for (const c of clouds) {
      const el = document.createElement('canvas')
      el.className = styles.cloud
      el.width = (c.w + 2 * PAD) * cP
      el.height = (c.h + 2 * PAD) * cP
      el.style.width = `${(c.w + 2 * PAD) * cs}px`
      el.style.height = `${(c.h + 2 * PAD) * cs}px`
      layer.appendChild(el)
      c.el = el
      c.ctx = el.getContext('2d', { willReadFrequently: true })
      const top = (c.y - PAD) * cs
      const at = (x) => `translate3d(${(x - PAD) * cs}px, ${top}px, 0)`
      if (still) {
        el.style.transform = at(c.start)
        continue
      }
      c.anim = el.animate([{ transform: at(-c.w) }, { transform: at(cols) }], {
        duration: ((cols + c.w) / c.speed) * 1000,
        iterations: Infinity,
        iterationStart: (c.start + c.w) / (cols + c.w),
        easing: 'linear',
      })
      if (!visible || document.hidden) c.anim.pause()
    }
  }

  function unmountClouds() {
    for (const c of clouds) {
      c.anim?.cancel()
      c.el?.remove()
    }
  }

  /** A cloud's cells, each on its own patch of paper, wherever the wind has blown them */
  function drawCloud(c) {
    const g = c.ctx
    g.clearRect(0, 0, c.el.width, c.el.height)
    g.fillStyle = paper
    for (let j = 0; j < c.len; j++) {
      const x = Math.round((PAD + c.xs[j] + c.dx[j]) * cP)
      const y = Math.round((PAD + c.ys[j] + c.dy[j]) * cP)
      g.globalAlpha = 1
      g.fillRect(x, y, cP, cP)
      let glyph = c.gs[j]
      // a cell being blown along shows as a streak
      const vx = c.vx[j]
      const vy = c.vy[j]
      if (vx * vx + vy * vy > 36) glyph = strokeFor(vx, vy)
      if (!glyph) continue
      g.globalAlpha = c.as[j]
      g.drawImage(atlas, glyph * cP, INK * cP, cP, cP, x, y, cP, cP)
    }
    g.globalAlpha = 1
  }

  function drawClouds() {
    if (remount) mountClouds()
    remount = false
    clouds.forEach(drawCloud)
  }

  function resize() {
    const box = wrap.getBoundingClientRect()
    if (!box.width || !box.height) return false
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    // cells are whole device pixels, so the grid stays crisp
    cP = Math.round((box.width < 640 ? 10 : 12) * dpr)
    cs = cP / dpr
    const nextCols = Math.ceil(box.width / cs)
    const nextRows = Math.ceil(box.height / cs)
    const sameGrid = nextCols === cols && nextRows === rows
    cols = nextCols
    rows = nextRows
    origin = { x: box.left + window.scrollX, y: box.top + window.scrollY }
    if (!sameGrid) {
      n = cols * rows
      canvas.width = cols * cP
      canvas.style.width = `${cols * cs}px`
      canvas.height = rows * cP
      canvas.style.height = `${rows * cs}px`
      ;[bG, nG, nC, nS, nSC, cG, cC, cQ, cS, cSC, cSQ, windG] = Array.from({ length: 12 }, () => new Uint8Array(n))
      ;[sky, nA, nSA, mask, wind] = Array.from({ length: 5 }, () => new Float32Array(n))
      gusts.clear()
      unmountClouds()
      makeClouds()
      remount = true
    }
    return true
  }

  function rebuild() {
    if (!resize()) return
    dark = document.documentElement.dataset.theme === 'dark'
    makeAtlas()
    drawClouds()
    paintScene()
    ready = true
    compose(true)
  }

  /** The first build, spread over two frames; the loop then draws the sky in a few ticks */
  function boot() {
    if (!resize()) return
    dark = document.documentElement.dataset.theme === 'dark'
    makeAtlas()
    bootRaf = requestAnimationFrame(() => {
      drawClouds()
      paintScene()
      ready = true
      wrap.classList.add(styles.on)
      if (still) compose(true)
      else run()
    })
  }

  /**
   * Work out the frame, then draw the cells that changed: all of them when
   * `full`, otherwise up to BUDGET (the rest still differ, so they go next
   * tick). Returns how many cells it drew.
   */
  function compose(full = false) {
    nG.set(bG)
    nC.fill(INK)
    nA.set(sky)
    nS.fill(0)

    for (const s of stars) {
      const v = 0.5 + 0.5 * Math.sin(time * s.w + s.ph)
      if (v < 0.3) continue // dimmed down to a plain tile
      nG[s.i] = v > 0.85 ? G['*'] : v > 0.55 ? G['+'] : G['.']
      nA[s.i] = s.a * v * sky[s.i]
    }

    for (const i of gusts) {
      const e = wind[i]
      nS[i] = windG[i]
      nSC[i] = e > 0.5 ? ACCENT : BLUE
      nSA[i] = Math.min(1, e * 1.3) * Math.max(0.4, sky[i])
    }

    if (full) ctx.clearRect(0, 0, canvas.width, canvas.height)
    let budget = full ? n : BUDGET
    for (let i = 0; i < n && budget > 0; i++) {
      const g = nG[i]
      const m = mask[i]
      const q = g === 0 ? 0 : Math.min(LEVELS, Math.round(nA[i] * m * LEVELS))
      const s = nS[i]
      const sq = s === 0 ? 0 : Math.min(LEVELS, Math.round(nSA[i] * m * LEVELS))
      if (
        !full &&
        q === cQ[i] &&
        sq === cSQ[i] &&
        (q === 0 || (g === cG[i] && nC[i] === cC[i])) &&
        (sq === 0 || (s === cS[i] && nSC[i] === cSC[i]))
      )
        continue
      budget--
      cG[i] = g
      cC[i] = nC[i]
      cQ[i] = q
      cS[i] = s
      cSC[i] = nSC[i]
      cSQ[i] = sq
      const x = (i % cols) * cP
      const y = ((i / cols) | 0) * cP
      if (!full) ctx.clearRect(x, y, cP, cP)
      // a stroke over a star replaces it; over a tile it's drawn on top, the
      // tile paled a little so the stroke stands out
      if (q && !(sq && g < TILE)) {
        ctx.globalAlpha = (q / LEVELS) * (sq ? 1 - 0.55 * (sq / LEVELS) : 1)
        ctx.drawImage(atlas, g * cP, (g >= TILE ? 0 : nC[i]) * cP, cP, cP, x, y, cP, cP)
      }
      if (sq) {
        ctx.globalAlpha = sq / LEVELS
        ctx.drawImage(atlas, s * cP, nSC[i] * cP, cP, cP, x, y, cP, cP)
      }
    }
    ctx.globalAlpha = 1
    return (full ? n : BUDGET) - budget
  }

  /** Torn clouds: blown cells slow down and drift back into place */
  function stepClouds(dt) {
    const damp = Math.exp(-dt * 3.2)
    for (const c of clouds) {
      if (!c.torn) continue
      // blown cells slow down and drift back into place
      let moving = false
      for (let j = 0; j < c.len; j++) {
        c.vx[j] = (c.vx[j] - c.dx[j] * 5 * dt) * damp
        c.vy[j] = (c.vy[j] - c.dy[j] * 5 * dt) * damp
        c.dx[j] += c.vx[j] * dt
        c.dy[j] += c.vy[j] * dt
        if (Math.abs(c.dx[j]) > 0.3 || Math.abs(c.dy[j]) > 0.3 || Math.abs(c.vx[j]) > 0.3 || Math.abs(c.vy[j]) > 0.3)
          moving = true
      }
      if (!moving) {
        c.dx.fill(0)
        c.dy.fill(0)
        c.vx.fill(0)
        c.vy.fill(0)
        c.torn = false
      }
      drawCloud(c)
    }
  }

  /** The tiles: stars twinkle and wind strokes fade */
  function stepTiles(dt) {
    time += dt
    fadeWind(dt)
  }

  function fadeWind(dt) {
    const fade = Math.exp(-dt / WIND_S)
    for (const i of gusts) {
      wind[i] *= fade
      if (wind[i] < 0.04) {
        wind[i] = 0
        gusts.delete(i)
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame)
    if (now - last < TICK_MS) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    // a torn cloud keeps mending while the page scrolls (only its own small
    // canvas is redrawn); held still, it froze until the scroll's glide ended
    stepClouds(dt)
    // while the page scrolls the tiles hold still (the big canvas would be
    // re-uploaded on every scrolled frame), except for a wind trail, which
    // keeps fading, a little faster, so it never hangs frozen mid-scroll
    if (now - lastScroll < STILL_MS) {
      if (!gusts.size) return
      fadeWind(dt * 2.5)
    } else {
      stepTiles(dt)
    }
    compose()
  }

  function run() {
    // the clouds glide on the compositor, even while the page scrolls; they stop only off screen
    for (const c of clouds) {
      if (!c.anim) continue
      if (visible && !document.hidden) c.anim.play()
      else c.anim.pause()
    }
    const go = ready && visible && !document.hidden && !still
    if (go && !raf) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    } else if (!go && raf) {
      cancelAnimationFrame(raf)
      raf = 0
      mend()
    }
  }

  /** Off screen: put torn clouds back together and clear the wind, so the sky is whole on the way back */
  function mend() {
    for (const c of clouds) {
      if (!c.torn) continue
      c.dx.fill(0)
      c.dy.fill(0)
      c.vx.fill(0)
      c.vy.fill(0)
      c.torn = false
      drawCloud(c)
    }
    if (!gusts.size) return
    for (const i of gusts) wind[i] = 0
    gusts.clear()
    // wipe the strokes a budget at a time, between frames, until the tiles are clean
    const clean = () => {
      if (compose() >= BUDGET) cleanTimer = setTimeout(clean, 16)
    }
    clean()
  }

  // ---------- wind ----------
  function blow(x0, y0, x1, y1, ms) {
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    if (len < 1) return
    const speed = len / ms // px per ms
    const glyph = strokeFor(dx, dy)
    const half = speed < 0.35 ? 0 : speed < 1.1 ? 1 : 2 // faster is wider
    const nx = -dy / len
    const ny = dx / len
    const steps = Math.ceil(len / (cs * 0.5))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      for (let k = -half; k <= half; k++) {
        const x = Math.floor((x0 + dx * t + nx * k * cs) / cs)
        const y = Math.floor((y0 + dy * t + ny * k * cs) / cs)
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue
        const i = y * cols + x
        wind[i] = 1
        windG[i] = glyph
        gusts.add(i)
      }
    }

    // tear the clouds the stroke runs through: every cell near the stroke is
    // blown along it, harder the closer it is (velocity in cells per second)
    const wx = Math.max(-40, Math.min(40, (dx / cs / Math.max(16, ms)) * 1000))
    const wy = Math.max(-40, Math.min(40, (dy / cs / Math.max(16, ms)) * 1000))
    const ax = x0 / cs
    const ay = y0 / cs
    const bx = x1 / cs
    const by = y1 / cs
    const lx = bx - ax
    const ly = by - ay
    const l2 = lx * lx + ly * ly || 1
    for (const c of clouds) {
      const ox = cloudX(c)
      const oy = c.y
      if (Math.max(ax, bx) < ox - TEAR_R - 4 || Math.min(ax, bx) > ox + c.w + TEAR_R + 4) continue
      if (Math.max(ay, by) < oy - TEAR_R - 4 || Math.min(ay, by) > oy + c.h + TEAR_R + 4) continue
      for (let j = 0; j < c.len; j++) {
        const px = ox + c.xs[j] + c.dx[j] + 0.5
        const py = oy + c.ys[j] + c.dy[j] + 0.5
        const t = Math.max(0, Math.min(1, ((px - ax) * lx + (py - ay) * ly) / l2))
        const d = Math.hypot(px - (ax + lx * t), py - (ay + ly * t))
        if (d > TEAR_R) continue
        const f = (1 - d / TEAR_R) ** 2 * (0.6 + 0.4 * hash(j, c.w))
        c.vx[j] += wx * f * 0.9
        c.vy[j] += wy * f * 0.9
        c.torn = true
      }
    }
  }

  const onMove = (e) => {
    if (!raf) return
    const x = e.pageX - origin.x
    const y = e.pageY - origin.y
    const t = e.timeStamp
    if (pointer) blow(pointer.x, pointer.y, x, y, Math.max(1, t - pointer.t))
    pointer = { x, y, t }
  }
  const onLeave = () => {
    pointer = null
  }
  const onScroll = () => {
    lastScroll = performance.now()
    pointer = null
  }
  const onVisibility = () => run()

  // ---------- set up ----------
  let resizeTimer = 0
  let observed = false
  const ro = new ResizeObserver(() => {
    // the first call only reports the sizes we start with
    if (!observed) {
      observed = true
      return
    }
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(rebuild, 150)
  })
  ro.observe(wrap)
  if (avoid) ro.observe(avoid)
  if (quiet) ro.observe(quiet)
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    run()
  })
  io.observe(wrap)
  if (!still) {
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
  }

  boot()

  return {
    /** the theme just changed: repaint at once, so the new view (the theme reveal) already has it */
    retheme: () => ready && rebuild(),
    destroy() {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(bootRaf)
      clearTimeout(resizeTimer)
      clearTimeout(cleanTimer)
      ro.disconnect()
      io.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      unmountClouds()
    },
  }
}

/**
 * start: the hero's intro has begun (the sky fades in once the name is up).
 * host: the element whose pointer moves make wind. avoid: the text to keep
 * the sky faint behind; quiet: text to keep it softer behind. still: draw
 * once, no motion and no wind.
 */
export default function HeroSky({ start, theme, still = false, host, avoid, quiet }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const layerRef = useRef(null)
  const sky = useRef(null)

  useEffect(() => {
    if (!start || !host) return undefined
    const timer = setTimeout(() => {
      sky.current = createSky({
        wrap: wrapRef.current,
        canvas: canvasRef.current,
        layer: layerRef.current,
        host,
        avoid,
        quiet,
        still,
      })
    }, START_MS)
    return () => {
      clearTimeout(timer)
      sky.current?.destroy()
      sky.current = null
    }
  }, [start, host, avoid, quiet, still])

  useLayoutEffect(() => {
    sky.current?.retheme()
  }, [theme])

  return (
    <div ref={wrapRef} className={styles.sky} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={layerRef} className={styles.clouds} />
    </div>
  )
}

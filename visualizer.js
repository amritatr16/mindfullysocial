/* ==========================================================================
   MindfulFeed visualisers (p5.js)
   1. Category radar  (+ optional engagement overlay)
   2. Content ↔ feelings web map
   3. Feeling bubbles
   Python pushes state in through window.updateP5Data(jsonString).
   ========================================================================== */

const CATEGORIES = ['Politics', 'News', 'Memes/Comedy', 'Lifestyle', 'Food', 'Sports', 'Art', 'Advertisements'];
const FEELINGS = ['Inspired', 'Anxious', 'Energized', 'Drained', 'Calm', 'Distracted', 'Connected'];

const SHORT_NAMES = { 'Memes/Comedy': 'Memes', 'Advertisements': 'Ads' };
const shortName = (n) => SHORT_NAMES[n] || n;

const CATEGORY_COLORS = {
  'Politics': '#f87171', 'News': '#60a5fa', 'Memes/Comedy': '#fbbf24', 'Lifestyle': '#34d399',
  'Food': '#fb923c', 'Sports': '#22d3ee', 'Art': '#a78bfa', 'Advertisements': '#94a3b8'
};
const FEELING_COLORS = {
  'Inspired': '#34d399', 'Anxious': '#f87171', 'Energized': '#fbbf24',
  'Drained': '#94a3b8', 'Calm': '#38bdf8', 'Distracted': '#c084fc', 'Connected': '#f472b6'
};

const SEEN_RGB = [34, 211, 238];     // cyan  – posts seen
const ENGAGE_RGB = [251, 191, 36];   // amber – posts engaged with

const zeroMap = (keys) => Object.fromEntries(keys.map(k => [k, 0]));
const emptyData = () => ({
  categoryCounts: zeroMap(CATEGORIES),
  categoryEngagements: zeroMap(CATEGORIES),
  feelingCounts: zeroMap(FEELINGS),
  linkCounts: Object.fromEntries(CATEGORIES.map(c => [c, zeroMap(FEELINGS)]))
});

let pyData = emptyData();
let showEngagement = true;

// Global callback triggered by Python
window.updateP5Data = function (jsonStr) {
  pyData = Object.assign(emptyData(), JSON.parse(jsonStr));
};

/* ---------- small helpers ---------- */
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const fmt = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

function makeCanvas(p, id) {
  const wrap = document.getElementById(id);
  p.createCanvas(Math.max(1, wrap.clientWidth), Math.max(1, wrap.clientHeight)).parent(id);
  p.textFont('Inter, system-ui, sans-serif');
  // Resize with the container (also handles the mobile tab switch)
  new ResizeObserver(() => {
    const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
    if (w !== p.width || h !== p.height) p.resizeCanvas(w, h);
  }).observe(wrap);
}

function drawTooltip(p, x, y, title, lines, accentRgb) {
  p.textSize(11);
  p.textStyle(p.BOLD);
  let w = p.textWidth(title);
  p.textStyle(p.NORMAL);
  lines.forEach(l => { w = Math.max(w, p.textWidth(l)); });
  const padX = 10, padY = 8, lh = 15;
  const bw = w + padX * 2, bh = padY * 2 + lh * (lines.length + 1) - 2;
  let bx = x + 14, by = y + 14;
  if (bx + bw > p.width - 4) bx = x - bw - 14;
  if (by + bh > p.height - 4) by = y - bh - 14;
  bx = Math.max(4, bx); by = Math.max(4, by);

  p.stroke(148, 163, 184, 70);
  p.strokeWeight(1);
  p.fill(6, 10, 19, 238);
  p.rect(bx, by, bw, bh, 8);
  p.noStroke();
  p.textAlign(p.LEFT, p.TOP);
  p.fill(accentRgb[0], accentRgb[1], accentRgb[2]);
  p.textStyle(p.BOLD);
  p.text(title, bx + padX, by + padY);
  p.textStyle(p.NORMAL);
  p.fill(203, 213, 225);
  lines.forEach((l, i) => p.text(l, bx + padX, by + padY + lh * (i + 1)));
}

const mouseInside = (p) => p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;

/* ==========================================================================
   1. CATEGORY RADAR  (seen = cyan, engaged = amber overlay)
   ========================================================================== */
const sketchRadar = (p) => {
  const ID = 'canvas-wrapper-1';
  const n = CATEGORIES.length;
  const seenDisp = new Array(n).fill(0);
  const engDisp = new Array(n).fill(0);
  let maxDisp = 4;
  let engFade = 1;

  p.setup = () => makeCanvas(p, ID);

  p.draw = () => {
    p.clear();
    const step = p.TWO_PI / n;
    const cx = p.width / 2, cy = p.height / 2 + 4;
    const radius = Math.max(30, Math.min(p.width * 0.30, p.height * 0.35));
    const ctx = p.drawingContext;

    // Targets and smoothing so the shapes glide instead of jumping
    const seenT = CATEGORIES.map(c => pyData.categoryCounts[c] || 0);
    const engT = CATEGORIES.map(c => pyData.categoryEngagements[c] || 0);
    const rawMax = Math.max(4, ...seenT, ...(showEngagement ? engT : [0]));
    maxDisp = p.lerp(maxDisp, rawMax, 0.1);
    engFade = p.lerp(engFade, showEngagement ? 1 : 0, 0.14);
    for (let i = 0; i < n; i++) {
      seenDisp[i] = p.lerp(seenDisp[i], seenT[i], 0.12);
      engDisp[i] = p.lerp(engDisp[i], engT[i], 0.12);
    }
    const norm = (v) => 0.08 + 0.92 * Math.min(1, v / maxDisp);
    const ang = (i) => i * step - p.HALF_PI;

    // Hover detection (nearest axis)
    let hover = -1;
    if (mouseInside(p)) {
      const dx = p.mouseX - cx, dy = p.mouseY - cy;
      if (Math.hypot(dx, dy) < radius * 1.3) {
        let a = Math.atan2(dy, dx) + p.HALF_PI;
        a = (a + p.TWO_PI) % p.TWO_PI;
        hover = Math.round(a / step) % n;
      }
    }

    // Grid rings + value ticks
    p.noFill();
    for (let l = 1; l <= 4; l++) {
      const rL = (radius / 4) * l;
      p.stroke(148, 163, 184, l === 4 ? 46 : 26);
      p.strokeWeight(1);
      p.beginShape();
      for (let i = 0; i < n; i++) p.vertex(cx + Math.cos(ang(i)) * rL, cy + Math.sin(ang(i)) * rL);
      p.endShape(p.CLOSE);
      p.noStroke();
      p.fill(100, 116, 139, 150);
      p.textSize(8);
      p.textAlign(p.LEFT, p.CENTER);
      p.text(Math.round(maxDisp * l / 4), cx + 4, cy - rL + 1);
      p.noFill();
    }

    // Axes + category labels
    p.textSize(10.5);
    for (let i = 0; i < n; i++) {
      const a = ang(i), cosA = Math.cos(a), sinA = Math.sin(a);
      const col = hexRgb(CATEGORY_COLORS[CATEGORIES[i]]);
      p.stroke(148, 163, 184, i === hover ? 90 : 36);
      p.strokeWeight(1);
      p.line(cx, cy, cx + cosA * radius, cy + sinA * radius);

      const d = radius + 14;
      p.noStroke();
      p.fill(col[0], col[1], col[2], i === hover ? 255 : 190);
      p.textAlign(cosA > 0.3 ? p.LEFT : cosA < -0.3 ? p.RIGHT : p.CENTER, sinA > 0.5 ? p.TOP : sinA < -0.5 ? p.BOTTOM : p.CENTER);
      p.text(shortName(CATEGORIES[i]), cx + cosA * d, cy + sinA * d);
    }

    // Polygon helper
    const poly = (vals, rgb, fillA, strokeA, glow) => {
      ctx.save();
      if (glow) { ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`; ctx.shadowBlur = 16; }
      p.fill(rgb[0], rgb[1], rgb[2], fillA);
      p.stroke(rgb[0], rgb[1], rgb[2], strokeA);
      p.strokeWeight(2);
      p.beginShape();
      for (let i = 0; i < n; i++) {
        const r = radius * norm(vals[i]);
        p.vertex(cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r);
      }
      p.endShape(p.CLOSE);
      ctx.restore();
    };
    const dots = (vals, rgb, alpha, size) => {
      p.noStroke();
      for (let i = 0; i < n; i++) {
        const r = radius * norm(vals[i]);
        p.fill(rgb[0], rgb[1], rgb[2], alpha);
        p.ellipse(cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r, size, size);
      }
    };

    // Seen (cyan) underneath, engagement (amber) overlapping on top
    poly(seenDisp, SEEN_RGB, 70, 230, true);
    dots(seenDisp, SEEN_RGB, 255, 6);
    if (engFade > 0.02) {
      poly(engDisp, ENGAGE_RGB, 90 * engFade, 240 * engFade, true);
      dots(engDisp, ENGAGE_RGB, 255 * engFade, 6);
    }

    // Tooltip
    if (hover >= 0) {
      const cat = CATEGORIES[hover];
      const seen = pyData.categoryCounts[cat] || 0;
      const eng = pyData.categoryEngagements[cat] || 0;
      const lines = [`Seen: ${seen}`];
      if (showEngagement) {
        lines.push(`Engaged: ${eng}`);
        if (seen > 0) lines.push(`Engagement rate: ${Math.round(eng / seen * 100)}%`);
      }
      drawTooltip(p, p.mouseX, p.mouseY, cat, lines, hexRgb(CATEGORY_COLORS[cat]));
    }
  };
};

/* ==========================================================================
   2. WEB MAP – content types ↔ feelings
   Left arc = content, right arc = feelings. Edge thickness = how often a
   content type was tagged with that feeling. Hover a node to trace its links.
   ========================================================================== */
const sketchWeb = (p) => {
  const ID = 'canvas-wrapper-3';
  const linkDisp = Object.fromEntries(CATEGORIES.map(c => [c, zeroMap(FEELINGS)]));
  const catDisp = zeroMap(CATEGORIES);
  const feelDisp = zeroMap(FEELINGS);

  p.setup = () => makeCanvas(p, ID);

  p.draw = () => {
    p.clear();
    const w = p.width, h = p.height;
    const cx = w / 2, cy = h / 2 + 8;
    const t = p.frameCount * 0.006;
    const rx = Math.max(40, w / 2 - 104), ry = Math.max(40, h / 2 - 36);
    const span = 2.5;

    // Smooth the data
    let maxW = 1, total = 0;
    CATEGORIES.forEach(c => {
      catDisp[c] = p.lerp(catDisp[c], pyData.categoryCounts[c] || 0, 0.1);
      FEELINGS.forEach(f => {
        linkDisp[c][f] = p.lerp(linkDisp[c][f], (pyData.linkCounts[c] || {})[f] || 0, 0.1);
        maxW = Math.max(maxW, linkDisp[c][f]);
        total += linkDisp[c][f];
      });
    });
    FEELINGS.forEach(f => { feelDisp[f] = p.lerp(feelDisp[f], pyData.feelingCounts[f] || 0, 0.1); });

    // Node layout with a gentle drift
    const drift = (seed) => [(p.noise(seed, t) - 0.5) * 14, (p.noise(seed + 50, t) - 0.5) * 14];
    const cats = CATEGORIES.map((c, i) => {
      const a = Math.PI - (i / (CATEGORIES.length - 1) - 0.5) * span;
      const [dx, dy] = drift(i * 3.1);
      return { type: 'cat', name: c, i, x: cx + rx * Math.cos(a) + dx, y: cy + ry * Math.sin(a) + dy,
               color: hexRgb(CATEGORY_COLORS[c]), r: Math.min(20, 6 + Math.sqrt(catDisp[c]) * 3.2) };
    });
    const feels = FEELINGS.map((f, j) => {
      const a = (j / (FEELINGS.length - 1) - 0.5) * span;
      const [dx, dy] = drift(100 + j * 3.1);
      return { type: 'feel', name: f, i: j, x: cx + rx * Math.cos(a) + dx, y: cy + ry * Math.sin(a) + dy,
               color: hexRgb(FEELING_COLORS[f]), r: Math.min(20, 6 + Math.sqrt(feelDisp[f]) * 3.2) };
    });
    const all = cats.concat(feels);

    // Hover
    let hover = null;
    if (mouseInside(p)) {
      let best = 1e9;
      all.forEach(nd => {
        const d = Math.hypot(p.mouseX - nd.x, p.mouseY - nd.y);
        if (d < nd.r + 10 && d < best) { best = d; hover = nd; }
      });
    }
    const linkOf = (c, f) => linkDisp[c][f];
    const related = (nd) => {
      if (!hover) return true;
      if (nd === hover) return true;
      if (hover.type === 'cat' && nd.type === 'feel') return linkOf(hover.name, nd.name) > 0.05;
      if (hover.type === 'feel' && nd.type === 'cat') return linkOf(nd.name, hover.name) > 0.05;
      return false;
    };

    // Column captions
    p.noStroke();
    p.fill(100, 116, 139);
    p.textSize(10);
    p.textAlign(p.LEFT, p.TOP);
    p.text('Content you saw', 10, 8);
    p.textAlign(p.RIGHT, p.TOP);
    p.text('How it felt', w - 10, 8);

    // Curve control points pulled toward the centre → a woven web
    const ctrl = (nd) => [nd.x + (cx - nd.x) * 0.55, nd.y + (cy - nd.y) * 0.55];

    // Faint structure: every possible connection
    p.noFill();
    p.strokeWeight(0.7);
    p.stroke(148, 163, 184, 14);
    cats.forEach(a => feels.forEach(b => {
      const [c1x, c1y] = ctrl(a), [c2x, c2y] = ctrl(b);
      p.bezier(a.x, a.y, c1x, c1y, c2x, c2y, b.x, b.y);
    }));

    // Active links, coloured by feeling
    cats.forEach(a => feels.forEach(b => {
      const v = linkOf(a.name, b.name);
      if (v < 0.03) return;
      const s = Math.min(1, v / maxW);
      const isHot = hover && (hover === a || hover === b);
      const dim = hover ? (isHot ? 1 : 0.1) : 1;
      const [c1x, c1y] = ctrl(a), [c2x, c2y] = ctrl(b);
      p.noFill();
      p.stroke(b.color[0], b.color[1], b.color[2], (55 + 190 * s) * dim);
      p.strokeWeight((0.9 + 5.5 * s) * (isHot ? 1.25 : 1));
      p.bezier(a.x, a.y, c1x, c1y, c2x, c2y, b.x, b.y);

      // Small particles travelling content → feeling
      const count = s > 0.5 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const ph = ((t * (0.8 + s) + (a.i * 7 + b.i * 3 + k * 5) * 0.137) % 1 + 1) % 1;
        const px = p.bezierPoint(a.x, c1x, c2x, b.x, ph);
        const py = p.bezierPoint(a.y, c1y, c2y, b.y, ph);
        p.noStroke();
        p.fill(255, 255, 255, 210 * dim);
        p.ellipse(px, py, 2.4 + s * 2, 2.4 + s * 2);
      }
    }));

    // Nodes + labels
    all.forEach(nd => {
      const rel = related(nd);
      const dim = rel ? 1 : 0.25;
      p.noStroke();
      p.fill(nd.color[0], nd.color[1], nd.color[2], 30 * dim);
      p.ellipse(nd.x, nd.y, nd.r * 2.8);
      p.stroke(6, 10, 19, 220);
      p.strokeWeight(2);
      p.fill(nd.color[0], nd.color[1], nd.color[2], 255 * dim);
      p.ellipse(nd.x, nd.y, nd.r * 2);

      p.noStroke();
      p.textSize(10.5);
      p.textStyle(nd === hover ? p.BOLD : p.NORMAL);
      p.fill(226, 232, 240, (nd === hover ? 255 : 200) * dim);
      if (nd.type === 'cat') { p.textAlign(p.RIGHT, p.CENTER); p.text(shortName(nd.name), nd.x - nd.r - 8, nd.y); }
      else { p.textAlign(p.LEFT, p.CENTER); p.text(nd.name, nd.x + nd.r + 8, nd.y); }
      p.textStyle(p.NORMAL);
    });

    // Empty state
    if (total < 0.05) {
      p.noStroke();
      p.fill(148, 163, 184, 170);
      p.textSize(12);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('Tag how posts make you feel\nand the web will start to connect.', cx, cy);
    }

    // Tooltip
    if (hover) {
      const lines = [];
      let title = hover.name, subtitle;
      if (hover.type === 'cat') {
        subtitle = `${pyData.categoryCounts[hover.name] || 0} posts seen`;
        const top = FEELINGS.map(f => [f, (pyData.linkCounts[hover.name] || {})[f] || 0])
          .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
        lines.push(subtitle);
        if (top.length) top.forEach(([f, v]) => lines.push(`${f}: ${fmt(v)}`));
        else lines.push('No feelings tagged yet');
      } else {
        subtitle = `${fmt(pyData.feelingCounts[hover.name] || 0)} tagged`;
        const top = CATEGORIES.map(c => [c, (pyData.linkCounts[c] || {})[hover.name] || 0])
          .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
        lines.push(subtitle);
        if (top.length) top.forEach(([c, v]) => lines.push(`${shortName(c)}: ${fmt(v)}`));
        else lines.push('Not linked to any content yet');
      }
      drawTooltip(p, p.mouseX, p.mouseY, title, lines, hover.color);
    }
  };
};

/* ==========================================================================
   3. FEELING BUBBLES
   ========================================================================== */
const sketchBubbles = (p) => {
  const ID = 'canvas-wrapper-2';
  const bubbles = [];

  p.setup = () => {
    makeCanvas(p, ID);
    FEELINGS.forEach(f => {
      bubbles.push({
        feeling: f, size: 30,
        x: p.random(40, Math.max(41, p.width - 40)),
        y: p.random(40, Math.max(41, p.height - 40)),
        vx: p.random(-0.45, 0.45), vy: p.random(-0.45, 0.45)
      });
    });
  };

  p.draw = () => {
    p.clear();
    const ctx = p.drawingContext;

    bubbles.forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 30 || b.x > p.width - 30) b.vx *= -1;
      if (b.y < 30 || b.y > p.height - 30) b.vy *= -1;
      b.x = p.constrain(b.x, 30, Math.max(30, p.width - 30));
      b.y = p.constrain(b.y, 30, Math.max(30, p.height - 30));
      const target = Math.min(26 + (pyData.feelingCounts[b.feeling] || 0) * 5, 74);
      b.size = p.lerp(b.size, target, 0.12);
    });

    // Connecting lines between close bubbles (blend of the two feeling colours)
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const d = p.dist(a.x, a.y, b.x, b.y);
        const maxDist = 130;
        if (d < maxDist) {
          const ca = hexRgb(FEELING_COLORS[a.feeling]), cb = hexRgb(FEELING_COLORS[b.feeling]);
          p.stroke((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2, p.map(d, 0, maxDist, 150, 0));
          p.strokeWeight(1.2);
          p.line(a.x, a.y, b.x, b.y);
        }
      }
    }

    bubbles.forEach(b => {
      const count = pyData.feelingCounts[b.feeling] || 0;
      const col = hexRgb(FEELING_COLORS[b.feeling]);
      ctx.save();
      ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.55)`;
      ctx.shadowBlur = count > 0 ? 18 : 6;
      p.noStroke();
      p.fill(col[0], col[1], col[2], count > 0 ? 255 : 150);
      p.ellipse(b.x, b.y, b.size);
      ctx.restore();

      p.fill(10, 15, 28);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.textStyle(p.BOLD);
      p.text(b.feeling, b.x, count > 0 ? b.y - 4 : b.y);
      if (count > 0) {
        p.textSize(9);
        p.textStyle(p.NORMAL);
        p.text(fmt(count), b.x, b.y + 8);
      }
    });
  };
};

/* ==========================================================================
   UI helpers: toast, engagement toggle, mobile tabs
   ========================================================================== */
let toastTimer = null;
window.showToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-text').innerText = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
};

function wireUI() {
  const toggle = document.getElementById('toggle-engagement');
  const legend = document.getElementById('legend-engaged');
  toggle.addEventListener('click', () => {
    showEngagement = !showEngagement;
    toggle.setAttribute('aria-checked', String(showEngagement));
    toggle.classList.toggle('on', showEngagement);
    legend.classList.toggle('off', !showEngagement);
  });

  const tabs = { feed: document.getElementById('tab-feed'), insights: document.getElementById('tab-insights') };
  const panes = { feed: document.getElementById('pane-feed'), insights: document.getElementById('pane-insights') };
  Object.keys(tabs).forEach(name => {
    tabs[name].addEventListener('click', () => {
      Object.keys(tabs).forEach(k => {
        tabs[k].classList.toggle('active', k === name);
        tabs[k].setAttribute('aria-selected', String(k === name));
        panes[k].classList.toggle('pane-hidden', k !== name);
      });
    });
  });
}

window.addEventListener('load', () => {
  wireUI();
  new p5(sketchRadar);
  new p5(sketchWeb);
  new p5(sketchBubbles);
});

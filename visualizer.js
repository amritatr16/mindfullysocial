let pyData = {
  categoryCounts: { 'Politics': 0, 'News': 0, 'Memes/Comedy': 0, 'Lifestyle': 0, 'Food': 0, 'Sports': 0, 'Art': 0, 'Advertisements': 0 },
  categoryEngagements: { 'Politics': 0, 'News': 0, 'Memes/Comedy': 0, 'Lifestyle': 0, 'Food': 0, 'Sports': 0, 'Art': 0, 'Advertisements': 0 },
  feelingCounts: { 'Inspired': 0, 'Anxious': 0, 'Energized': 0, 'Drained': 0, 'Calm': 0, 'Distracted': 0, 'Connected': 0 }
};

const CATEGORIES = ['Politics', 'News', 'Memes/Comedy', 'Lifestyle', 'Food', 'Sports', 'Art', 'Advertisements'];
const FEELINGS = ['Inspired', 'Anxious', 'Energized', 'Drained', 'Calm', 'Distracted', 'Connected'];

const FEELING_COLORS = {
  'Inspired': '#34d399', 'Anxious': '#f87171', 'Energized': '#fbbf24',
  'Drained': '#94a3b8', 'Calm': '#38bdf8', 'Distracted': '#c084fc', 'Connected': '#f472b6'
};

// Global callback triggered by Python
window.updateP5Data = function(jsonStr) {
  pyData = JSON.parse(jsonStr);
};

// Canvas 1: Category Radar Chart
const sketch1 = (p) => {
  p.setup = () => {
    const container = document.getElementById('canvas-wrapper-1');
    p.createCanvas(container.clientWidth, container.clientHeight).parent('canvas-wrapper-1');
  };

  p.windowResized = () => {
    const container = document.getElementById('canvas-wrapper-1');
    if (container) p.resizeCanvas(container.clientWidth, container.clientHeight);
  };

  p.draw = () => {
    p.background(15, 23, 42);
    const cx = p.width / 2, cy = p.height / 2;
    const radius = Math.min(p.width, p.height) * 0.35;
    const totalCats = CATEGORIES.length;
    const angleStep = p.TWO_PI / totalCats;

    // Draw background polygon grids
    p.stroke(51, 65, 85, 120);
    p.noFill();
    for (let l = 1; l <= 3; l++) {
      const rL = (radius / 3) * l;
      p.beginShape();
      for (let i = 0; i < totalCats; i++) {
        const angle = i * angleStep - p.HALF_PI;
        p.vertex(cx + p.cos(angle) * rL, cy + p.sin(angle) * rL);
      }
      p.endShape(p.CLOSE);
    }

    // Filled radar polygon based on Python data
    p.beginShape();
    p.fill(6, 182, 212, 120);
    p.stroke(34, 211, 238);
    p.strokeWeight(2);

    let maxVal = 1;
    CATEGORIES.forEach(c => { if ((pyData.categoryCounts[c] || 0) > maxVal) maxVal = pyData.categoryCounts[c]; });

    for (let i = 0; i < totalCats; i++) {
      const cat = CATEGORIES[i];
      const val = pyData.categoryCounts[cat] || 0;
      const norm = p.map(val, 0, Math.max(maxVal, 4), 0.15, 1.0);
      const angle = i * angleStep - p.HALF_PI;
      p.vertex(cx + p.cos(angle) * (radius * norm), cy + p.sin(angle) * (radius * norm));
    }
    p.endShape(p.CLOSE);
  };
};

// Canvas 2: Wellbeing Particle Nodes
const sketch2 = (p) => {
  let bubbles = [];

  p.setup = () => {
    const container = document.getElementById('canvas-wrapper-2');
    p.createCanvas(container.clientWidth, container.clientHeight).parent('canvas-wrapper-2');
    FEELINGS.forEach(f => {
      bubbles.push({
        feeling: f,
        x: p.random(40, container.clientWidth - 40),
        y: p.random(40, container.clientHeight - 40),
        vx: p.random(-0.4, 0.4),
        vy: p.random(-0.4, 0.4)
      });
    });
  };

  p.draw = () => {
    p.background(15, 23, 42);

    bubbles.forEach(b => {
      const count = pyData.feelingCounts[b.feeling] || 0;
      const size = 20 + count * 8;

      b.x += b.vx; b.y += b.vy;
      if (b.x < 20 || b.x > p.width - 20) b.vx *= -1;
      if (b.y < 20 || b.y > p.height - 20) b.vy *= -1;

      p.noStroke();
      p.fill(FEELING_COLORS[b.feeling] || '#ffffff');
      p.ellipse(b.x, b.y, size);

      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.text(b.feeling, b.x, b.y);
    });
  };
};

window.onload = function() {
  new p5(sketch1);
  new p5(sketch2);
};
let pyData = {
  categoryCounts: { 'Politics': 0, 'News': 0, 'Memes/Comedy': 0, 'Lifestyle': 0, 'Food': 0, 'Sports': 0, 'Art': 0, 'Advertisements': 0 },
  categoryEngagements: { 'Politics': 0, 'News': 0, 'Memes/Comedy': 0, 'Lifestyle': 0, 'Food': 0, 'Sports': 0, 'Art': 0, 'Advertisements': 0 },
  feelingCounts: { 'Inspired': 0, 'Anxious': 0, 'Energized': 0, 'Drained': 0, 'Calm': 0, 'Distracted': 0, 'Connected': 0 }
};

const CATEGORIES = ['Politics', 'News', 'Memes/Comedy', 'Lifestyle', 'Food', 'Sports', 'Art', 'Advertisements'];
const FEELINGS = ['Inspired', 'Anxious', 'Energized', 'Drained', 'Calm', 'Distracted', 'Connected'];

window.showEngagementRadar = false;

const FEELING_COLORS = {
  'Inspired': '#34d399', 'Anxious': '#f87171', 'Energized': '#fbbf24',
  'Drained': '#94a3b8', 'Calm': '#38bdf8', 'Distracted': '#c084fc', 'Connected': '#f472b6'
};

// Global callback triggered by Python
window.updateP5Data = function(jsonStr) {
  pyData = JSON.parse(jsonStr);
};

// Canvas 1: Category Radar Chart with Labels
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
    const radius = Math.min(p.width, p.height) * 0.32;
    const totalCats = CATEGORIES.length;
    const angleStep = p.TWO_PI / totalCats;

    // Filled radar polygon based on Python data (Category Counts - Cyan)
    p.beginShape();
    p.fill(6, 182, 212, 110);
    p.stroke(34, 211, 238);
    p.strokeWeight(2);

    let maxVal = 1;
    CATEGORIES.forEach(c => { if ((pyData.categoryCounts[c] || 0) > maxVal) maxVal = pyData.categoryCounts[c]; });

    for (let i = 0; i < totalCats; i++) {
      const cat = CATEGORIES[i];
      const val = pyData.categoryCounts[cat] || 0;
      const norm = p.map(val, 0, Math.max(maxVal, 4), 0.15, 1.0);
      const angle = i * angleStep - p.HALF_PI;
      const px = cx + p.cos(angle) * (radius * norm);
      const pyPos = cy + p.sin(angle) * (radius * norm);
      p.vertex(px, pyPos);
    }
    p.endShape(p.CLOSE);

    // Plot vertex points for Category Counts
    for (let i = 0; i < totalCats; i++) {
      const cat = CATEGORIES[i];
      const val = pyData.categoryCounts[cat] || 0;
      const norm = p.map(val, 0, Math.max(maxVal, 4), 0.15, 1.0);
      const angle = i * angleStep - p.HALF_PI;
      const px = cx + p.cos(angle) * (radius * norm);
      const pyPos = cy + p.sin(angle) * (radius * norm);
      
      p.fill(34, 211, 238);
      p.noStroke();
      p.ellipse(px, pyPos, 6, 6);
    }

    // OVERLAPPING ENGAGEMENT RADAR (Amber/Orange) - Rendered if toggle is checked
    if (window.showEngagementRadar) {
      let maxEng = 1;
      CATEGORIES.forEach(c => { if ((pyData.categoryEngagements[c] || 0) > maxEng) maxEng = pyData.categoryEngagements[c]; });

      p.beginShape();
      p.fill(245, 158, 11, 120); // Amber-500 fill with transparency
      p.stroke(251, 191, 36);    # Amber-400 stroke
      p.strokeWeight(2);

      for (let i = 0; i < totalCats; i++) {
        const cat = CATEGORIES[i];
        const val = pyData.categoryEngagements[cat] || 0;
        const norm = p.map(val, 0, Math.max(maxEng, 4), 0.15, 1.0);
        const angle = i * angleStep - p.HALF_PI;
        const px = cx + p.cos(angle) * (radius * norm);
        const pyPos = cy + p.sin(angle) * (radius * norm);
        p.vertex(px, pyPos);
      }
      p.endShape(p.CLOSE);

      // Engagement Vertex Points
      for (let i = 0; i < totalCats; i++) {
        const cat = CATEGORIES[i];
        const val = pyData.categoryEngagements[cat] || 0;
        const norm = p.map(val, 0, Math.max(maxEng, 4), 0.15, 1.0);
        const angle = i * angleStep - p.HALF_PI;
        const px = cx + p.cos(angle) * (radius * norm);
        const pyPos = cy + p.sin(angle) * (radius * norm);
        
        p.fill(251, 191, 36);
        p.noStroke();
        p.ellipse(px, pyPos, 6, 6);
      }
    }
  };
};

// Canvas 2: Wellbeing Particle Nodes with Dynamic Connecting Lines
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
        vx: p.random(-0.5, 0.5),
        vy: p.random(-0.5, 0.5)
      });
    });
  };

  p.windowResized = () => {
    const container = document.getElementById('canvas-wrapper-2');
    if (container) p.resizeCanvas(container.clientWidth, container.clientHeight);
  };

  p.draw = () => {
    p.background(15, 23, 42);

    // Update positions & bounce off borders
    bubbles.forEach(b => {
      b.x += b.vx; 
      b.y += b.vy;
      if (b.x < 30 || b.x > p.width - 30) b.vx *= -1;
      if (b.y < 30 || b.y > p.height - 30) b.vy *= -1;
    });

    // Draw connecting lines between close nodes
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const d = p.dist(bubbles[i].x, bubbles[i].y, bubbles[j].x, bubbles[j].y);
        const maxDist = 120;
        if (d < maxDist) {
          const alpha = p.map(d, 0, maxDist, 180, 0);
          p.stroke(99, 102, 241, alpha); // Indigo stroke fade
          p.strokeWeight(1.2);
          p.line(bubbles[i].x, bubbles[i].y, bubbles[j].x, bubbles[j].y);
        }
      }
    }

    // Render nodes
    bubbles.forEach(b => {
      const count = pyData.feelingCounts[b.feeling] || 0;
      const size = 26 + count * 6;

      // Glow effect
      p.noStroke();
      p.fill(FEELING_COLORS[b.feeling] || '#ffffff');
      p.ellipse(b.x, b.y, size);

      // Node label
      p.fill(15, 23, 42); // Dark background contrast text
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.textStyle(p.BOLD);
      p.text(b.feeling, b.x, b.y - 1);
      
      // Count badge
      if (count > 0) {
        p.textSize(8);
        p.fill(255);
        p.text(`(${count})`, b.x, b.y + 10);
      }
    });
  };
};

window.onload = function() {
  new p5(sketch1);
  new p5(sketch2);
};

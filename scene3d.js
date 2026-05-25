(function () {
  "use strict";

  const canvas = document.getElementById("engineeringScene");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const nodes = [];
  const edges = [];
  const ducts = [];
  const particles = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let time = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildScene() {
    nodes.length = 0;
    edges.length = 0;
    ducts.length = 0;
    particles.length = 0;

    const cols = 8;
    const rows = 6;
    const levels = 4;
    const sx = 120;
    const sy = 90;
    const sz = 80;

    for (let z = 0; z < levels; z += 1) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          nodes.push({
            x: (x - (cols - 1) / 2) * sx,
            y: (y - (rows - 1) / 2) * sy,
            z: (z - (levels - 1) / 2) * sz,
          });
        }
      }
    }

    function id(x, y, z) {
      return z * cols * rows + y * cols + x;
    }

    for (let z = 0; z < levels; z += 1) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (x < cols - 1) edges.push([id(x, y, z), id(x + 1, y, z)]);
          if (y < rows - 1) edges.push([id(x, y, z), id(x, y + 1, z)]);
          if (z < levels - 1 && (x === 0 || x === cols - 1 || y === 0 || y === rows - 1)) {
            edges.push([id(x, y, z), id(x, y, z + 1)]);
          }
        }
      }
    }

    ducts.push(
      { a: { x: -430, y: -145, z: 80 }, b: { x: 430, y: -145, z: 80 }, width: 12 },
      { a: { x: -260, y: -145, z: 80 }, b: { x: -260, y: 210, z: -20 }, width: 8 },
      { a: { x: 0, y: -145, z: 80 }, b: { x: 0, y: 210, z: -20 }, width: 8 },
      { a: { x: 260, y: -145, z: 80 }, b: { x: 260, y: 210, z: -20 }, width: 8 }
    );

    for (let i = 0; i < 90; i += 1) {
      particles.push({
        duct: i % ducts.length,
        phase: Math.random(),
        speed: 0.04 + Math.random() * 0.045,
        radius: 1.2 + Math.random() * 2.2,
      });
    }
  }

  function rotate(point, ax, ay) {
    const cosY = Math.cos(ay);
    const sinY = Math.sin(ay);
    const cosX = Math.cos(ax);
    const sinX = Math.sin(ax);
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    return { x: x1, y: y1, z: z2 };
  }

  function project(point) {
    const angleX = -0.42 + Math.sin(time * 0.00018) * 0.04;
    const angleY = 0.68 + Math.sin(time * 0.00012) * 0.12;
    const p = rotate(point, angleX, angleY);
    const depth = 1150;
    const scale = depth / (depth + p.z);
    return {
      x: width * 0.58 + p.x * scale,
      y: height * 0.50 + p.y * scale,
      z: p.z,
      scale,
    };
  }

  function line(a, b, color, alpha, lineWidth) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawUnit() {
    const base = [
      { x: -520, y: -230, z: -120 },
      { x: -345, y: -230, z: -120 },
      { x: -345, y: -115, z: -120 },
      { x: -520, y: -115, z: -120 },
      { x: -520, y: -230, z: 5 },
      { x: -345, y: -230, z: 5 },
      { x: -345, y: -115, z: 5 },
      { x: -520, y: -115, z: 5 },
    ].map(project);
    const unitEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    unitEdges.forEach(([a, b]) => line(base[a], base[b], "#d7b56d", 0.62, 1.4));

    const center = project({ x: -432, y: -172, z: 20 });
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#79f5e8";
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, (18 + i * 8) * center.scale, time * 0.001 + i, time * 0.001 + Math.PI * 1.35 + i);
      ctx.stroke();
    }
  }

  function drawScene(now) {
    time = now || 0;
    ctx.clearRect(0, 0, width, height);

    const haze = ctx.createRadialGradient(width * 0.58, height * 0.42, 60, width * 0.58, height * 0.42, Math.max(width, height) * 0.72);
    haze.addColorStop(0, "rgba(52, 211, 191, 0.17)");
    haze.addColorStop(0.38, "rgba(37, 99, 235, 0.08)");
    haze.addColorStop(1, "rgba(2, 6, 23, 0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    const projected = nodes.map(project);
    edges.forEach(([a, b]) => {
      const pa = projected[a];
      const pb = projected[b];
      const depth = (pa.z + pb.z) * 0.5;
      line(pa, pb, "#7dd3fc", 0.10 + (depth + 280) / 1800, 0.9);
    });

    ducts.forEach((duct, index) => {
      const a = project(duct.a);
      const b = project(duct.b);
      line(a, b, index === 0 ? "#d7b56d" : "#5eead4", 0.58, duct.width * a.scale);
      line(a, b, "#ffffff", 0.10, Math.max(1, duct.width * a.scale * 0.18));
    });

    particles.forEach((particle) => {
      const duct = ducts[particle.duct];
      const phase = (particle.phase + time * 0.00004 * particle.speed * 60) % 1;
      const x = duct.a.x + (duct.b.x - duct.a.x) * phase;
      const y = duct.a.y + (duct.b.y - duct.a.y) * phase;
      const z = duct.a.z + (duct.b.z - duct.a.z) * phase;
      const p = project({ x, y, z });
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = particle.duct === 0 ? "#f7d889" : "#7ff7ec";
      ctx.beginPath();
      ctx.arc(p.x, p.y, particle.radius * p.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    projected.forEach((p, index) => {
      if (index % 5 !== 0) return;
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#bffefa";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8 * p.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    drawUnit();
    requestAnimationFrame(drawScene);
  }

  window.addEventListener("resize", resize);
  resize();
  buildScene();
  requestAnimationFrame(drawScene);
})();

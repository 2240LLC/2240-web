// js/constellation.js — relational node map of the catalogue.
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Base positions as fractions of the stage, keyed by entry id.
  const LAYOUT = {
    tonsure:   { x: 0.50, y: 0.26 },
    washboard: { x: 0.26, y: 0.60 },
    patient:   { x: 0.55, y: 0.78 },
    statues:   { x: 0.78, y: 0.46 },
  };

  let nodes = [];   // { id, el, base:{x,y}, phase }
  let edges = [];   // { line, a, b }
  let rafId = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stage() { return document.getElementById('constellation-stage'); }
  function svg()   { return document.getElementById('edge-layer'); }

  function relationships(data) {
    const pairs = [];
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const a = data[i], b = data[j];
        let kind = null;
        if (a.artist === b.artist) kind = 'artist';
        else if (a.year === b.year) kind = 'year';
        else if (a.tags && b.tags && a.tags.some(t => b.tags.includes(t))) kind = 'tag';
        if (kind) pairs.push({ a: a.id, b: b.id, kind });
      }
    }
    return pairs;
  }

  function build() {
    const data = window.CATALOGUE || [];
    const st = stage(), sv = svg();
    st.querySelectorAll('.node').forEach(n => n.remove());
    sv.innerHTML = '';
    nodes = []; edges = [];

    relationships(data).forEach(p => {
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'edge edge-' + p.kind);
      sv.appendChild(line);
      edges.push({ line, a: p.a, b: p.b });
    });

    data.forEach((r, i) => {
      const base = LAYOUT[r.id] || { x: 0.2 + (i % 4) * 0.2, y: 0.3 + Math.floor(i / 4) * 0.3 };
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'node';
      el.id = 'node-' + r.id;
      el.setAttribute('aria-label', 'Select ' + r.title + ' by ' + r.artist);
      el.innerHTML =
        '<span class="node-dot"></span>' +
        '<span class="node-label"><span class="node-no">' + r.no + '</span>' + r.title + '</span>';
      el.addEventListener('click', () => window.LIBRARY && window.LIBRARY.select(r.id));
      st.appendChild(el);
      nodes.push({ id: r.id, el, base, phase: i * 1.7 });
    });

    layout(0);
  }

  function centers(t) {
    const rect = stage().getBoundingClientRect();
    const out = {};
    nodes.forEach(n => {
      const dx = reduced ? 0 : Math.sin(t / 2600 + n.phase) * 6;
      const dy = reduced ? 0 : Math.cos(t / 3100 + n.phase) * 6;
      out[n.id] = { x: n.base.x * rect.width + dx, y: n.base.y * rect.height + dy };
    });
    return out;
  }

  function layout(t) {
    const pos = centers(t || 0);
    nodes.forEach(n => {
      const c = pos[n.id];
      n.el.style.left = c.x + 'px';
      n.el.style.top  = c.y + 'px';
    });
    edges.forEach(e => {
      const a = pos[e.a], b = pos[e.b];
      if (!a || !b) return;
      e.line.setAttribute('x1', a.x); e.line.setAttribute('y1', a.y);
      e.line.setAttribute('x2', b.x); e.line.setAttribute('y2', b.y);
    });
  }

  function tick(t) { layout(t); rafId = requestAnimationFrame(tick); }

  function start() {
    if (reduced) { layout(0); return; }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  function setActive(id) {
    nodes.forEach(n => n.el.classList.toggle('active', n.id === id));
    edges.forEach(e => e.line.classList.toggle('active', e.a === id || e.b === id));
  }

  window.addEventListener('resize', () => layout(performance.now()));
  window.CONSTELLATION = { build, setActive, start, stop };
})();

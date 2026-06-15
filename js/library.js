// js/library.js — orchestrates the focal player, selection, index table, view toggle.
(function () {
  let activeId = null;

  function entry(id) { return (window.CATALOGUE || []).find(r => r.id === id); }

  function streamLinksHTML(links) {
    return Object.entries(links).filter(([, u]) => u)
      .map(([n, u]) =>
        `<a href="${u}" target="_blank" rel="noopener" class="stream-link" aria-label="Listen on ${n} (opens in new tab)">${n}</a>`)
      .join('');
  }

  function renderIndex() {
    const data = window.CATALOGUE || [];
    const body = document.getElementById('index-body');
    body.innerHTML = data.map(r => `
      <div class="index-row" id="ix-${r.id}" role="row" tabindex="0"
           aria-label="Select ${r.title} by ${r.artist}">
        <span class="ix-no" role="cell">${r.no}</span>
        <span class="ix-title" role="cell">${r.title}</span>
        <span class="ix-artist" role="cell">${r.artist}</span>
        <span class="ix-year" role="cell">${r.year}</span>
        <span class="ix-dur" role="cell">${r.dur || '—'}</span>
        ${r.isNew ? '<span class="ix-new">NEW</span>' : '<span></span>'}
      </div>`).join('');

    body.querySelectorAll('.index-row').forEach(row => {
      const id = row.id.replace('ix-', '');
      const act = () => select(id);
      row.addEventListener('click', act);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); }
      });
    });
    document.getElementById('index-foot').textContent = 'Holdings: ' + data.length;
  }

  function select(id) {
    const r = entry(id);
    if (!r || id === activeId) return;
    activeId = id;
    document.documentElement.setAttribute('data-mode', r.mode);

    const eyebrow = document.getElementById('rel-eyebrow');
    eyebrow.innerHTML = (r.isNew ? '<span class="flag">NEW</span>' : '') +
      r.kind.toUpperCase() + ' · ' + r.year;
    document.getElementById('rel-title').textContent  = r.title;
    document.getElementById('rel-artist').textContent = r.artist;
    document.getElementById('stream-links').innerHTML = streamLinksHTML(r.links);

    document.getElementById('waveform')
      .setAttribute('aria-label', 'Audio waveform for ' + r.title + ' by ' + r.artist + '. Click to seek.');
    document.getElementById('play-btn')
      .setAttribute('aria-label', 'Play ' + r.title + ' by ' + r.artist);

    if (window.CONSTELLATION) window.CONSTELLATION.setActive(id);
    document.querySelectorAll('.index-row')
      .forEach(row => row.classList.toggle('active', row.id === 'ix-' + id));

    if (window.PLAYER) window.PLAYER.loadNewAudio(r.audio);
  }

  function setView(v) {
    document.getElementById('view-constellation').style.display = v === 'constellation' ? 'block' : 'none';
    document.getElementById('view-index').style.display = v === 'index' ? 'block' : 'none';
    document.querySelectorAll('.view-toggle button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'));
    try { sessionStorage.setItem('view', v); } catch (_) {}
    if (window.CONSTELLATION) {
      if (v === 'constellation') window.CONSTELLATION.start();
      else window.CONSTELLATION.stop();
    }
  }

  function init() {
    const data = window.CATALOGUE || [];
    if (!data.length) return;
    if (window.CONSTELLATION) window.CONSTELLATION.build();
    renderIndex();
    document.querySelectorAll('.view-toggle button').forEach(b =>
      b.addEventListener('click', () => setView(b.dataset.view)));

    select(data[0].id);

    let saved = null;
    try { saved = sessionStorage.getItem('view'); } catch (_) {}
    setView(saved || 'constellation');
  }

  window.LIBRARY = { select, setView };
  document.addEventListener('DOMContentLoaded', init);
})();

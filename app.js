const map = L.map('map').setView([27.96, -15.58], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const markers = new Map();
let allPlaces = [];
const categoriesEl = document.getElementById('categories');
const placesEl = document.getElementById('places');
const searchEl = document.getElementById('search');
const childEl = document.getElementById('child-filter');

function childClass(value='') {
  const v = value.toLowerCase();
  if (v.includes('не рекомендую') || v.includes('лучше без') || v.includes('не подходит')) return 'no';
  if (v.includes('условно')) return 'conditional';
  if (v.includes('подходит')) return 'yes';
  return 'unknown';
}
function esc(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render() {
  const query = searchEl.value.trim().toLocaleLowerCase('ru');
  const checked = [...categoriesEl.querySelectorAll('input:checked')].map(x => x.value);
  const child = childEl.value;
  const visible = allPlaces.filter(p => {
    const hay = [p.name,p.category,p.description,p.child_suitability].join(' ').toLocaleLowerCase('ru');
    return (!query || hay.includes(query)) && (!checked.length || checked.includes(p.category || 'Без категории')) && (child === 'all' || childClass(p.child_suitability) === child);
  });
  document.getElementById('count').textContent = visible.length;
  placesEl.innerHTML = visible.map(p => `<article class="place" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${esc(p.category || 'Без категории')}</small><small class="child">${esc(p.child_suitability || 'Детская пригодность не оценена')}</small></article>`).join('') || '<div class="hint">По заданным фильтрам ничего не найдено.</div>';
  for (const [id, marker] of markers) {
    const p = allPlaces.find(x => x.id === id);
    if (visible.includes(p)) marker.addTo(map); else map.removeLayer(marker);
  }
}
function focusPlace(id) {
  const p = allPlaces.find(x => x.id === id);
  const marker = markers.get(id);
  if (!p || !marker) return;
  document.querySelectorAll('.place').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  map.flyTo([p.latitude,p.longitude], Math.max(map.getZoom(), 13), {duration:.5});
  marker.openPopup();
}
fetch('data/places.json')
  .then(r => { if (!r.ok) throw new Error('Не удалось загрузить JSON каталога'); return r.json(); })
  .then(data => {
    allPlaces = data.filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
    const cats = [...new Set(allPlaces.map(p => p.category || 'Без категории'))].sort((a,b) => a.localeCompare(b,'ru'));
    categoriesEl.innerHTML = cats.map(c => `<label class="filter"><input type="checkbox" value="${esc(c)}" checked> ${esc(c)}</label>`).join('');
    allPlaces.forEach(p => {
      const marker = L.marker([p.latitude,p.longitude]);
      marker.bindPopup(`<div class="popup-title">${esc(p.name)}</div><div class="popup-meta">${esc(p.category || 'Без категории')}</div><div class="popup-description">${esc(p.description || '')}</div><div class="popup-child">${esc(p.child_suitability || 'Детская пригодность не оценена')}</div><a class="popup-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.latitude+','+p.longitude)}">Открыть в Google Maps ↗</a>`);
      markers.set(p.id, marker);
    });
    render();
    if (allPlaces.length === 1) {
      map.setView([allPlaces[0].latitude,allPlaces[0].longitude],12);
    } else if (allPlaces.length > 1) {
      const bounds = L.latLngBounds(allPlaces.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
    }

  })
  .catch(err => { document.getElementById('count').textContent = 'Ошибка'; placesEl.textContent = err.message; });
[searchEl, childEl].forEach(el => el.addEventListener('input', render));
categoriesEl.addEventListener('change', render);
placesEl.addEventListener('click', e => { const card = e.target.closest('.place'); if (card) focusPlace(card.dataset.id); });
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

const categories = [
  { id: 'nature', label: 'Природа и хайкинг', icon: '<i class="fa-solid fa-person-hiking" aria-hidden="true"></i>' },
  { id: 'beaches', label: 'Пляжи', icon: '<i class="fa-solid fa-umbrella-beach" aria-hidden="true"></i>' },
  { id: 'pools', label: 'Природные бассейны', icon: '<i class="fa-solid fa-person-swimming" aria-hidden="true"></i>' },
  { id: 'viewpoints', label: 'Смотровые площадки', icon: '<i class="fa-solid fa-binoculars" aria-hidden="true"></i>' },
  { id: 'towns', label: 'Деревни и города', icon: '<i class="fa-solid fa-house" aria-hidden="true"></i>' },
  { id: 'history', label: 'История и археология', icon: '<i class="fa-solid fa-landmark" aria-hidden="true"></i>' },
  { id: 'attractions', label: 'Парки и развлечения', icon: '<i class="fa-solid fa-ticket" aria-hidden="true"></i>' }
];
const categoryById = Object.fromEntries(categories.map(category => [category.id, category]));
const subcategories = { beaches: [
  { id: 'wild', label: 'Дикие', icon: '<i class="fa-solid fa-water" aria-hidden="true"></i>' },
  { id: 'tourist', label: 'Туристические', icon: '<i class="fa-solid fa-umbrella-beach" aria-hidden="true"></i>' }
] };
function categoryFilterMarkup(category) {
  const children = subcategories[category.id] || [];
  const childMarkup = children.map(sub => '<label class="filter subcategory-filter"><input type="checkbox" data-category="' + category.id + '" data-subcategory="' + sub.id + '" checked><span class="legend-icon">' + sub.icon + '</span><span>' + sub.label + '</span></label>').join('');
  return '<div class="category-group"><label class="filter category-filter"><input type="checkbox" data-category="' + category.id + '" checked><span class="legend-icon">' + category.icon + '</span><span>' + category.label + '</span></label>' + (children.length ? '<div class="subcategory-list">' + childMarkup + '</div>' : '') + '</div>';
}
function syncCategoryCheckbox(categoryId) {
  const parent = categoriesEl.querySelector('input[data-category="' + categoryId + '"]:not([data-subcategory])');
  const children = [...categoriesEl.querySelectorAll('input[data-category="' + categoryId + '"][data-subcategory]')];
  if (!parent || !children.length) return;
  const selected = children.filter(input => input.checked).length;
  parent.checked = selected === children.length;
  parent.indeterminate = selected > 0 && selected < children.length;
}
function categoryInfo(id) {
  return categoryById[id] || { id, label: 'Без категории', icon: '❔' };
}
function priorityInfo(priority) {
  const priorities = {
    must: { label: 'Must · обязательно посетить', className: 'priority-must' },
    should: { label: 'Should · стоит посетить', className: 'priority-should' },
    optional: { label: 'Optional · по желанию', className: 'priority-optional' }
  };
  return priorities[priority] || { label: 'Приоритет не задан', className: 'priority-unset' };
}
function markerIcon(categoryId, subcategory, priority) {
  const category = categoryInfo(categoryId);
  const sub = (subcategories[categoryId] || []).find(item => item.id === subcategory);
  const icon = sub?.icon || category.icon;
  return L.divIcon({
    className: 'category-marker-wrap',
    html: `<span class="category-marker ${priorityInfo(priority).className}" role="img" aria-label="${esc(category.label)} — ${esc(priorityInfo(priority).label)}">${icon}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -17]
  });
}
function googleMapsUrl(place) {
  const query = place.name + ', Gran Canaria, Spain ' + place.latitude + ',' + place.longitude;
  const params = new URLSearchParams({ api: '1', query, hl: 'en' });
  if (place.google_place_id) params.set('query_place_id', place.google_place_id);
  return 'https://www.google.com/maps/search/?' + params.toString();
}
function childClass(place) {
  const ratings = {
    good: 'yes',
    conditional: 'conditional',
    not_recommended: 'no',
    unknown: 'unknown'
  };
  return ratings[place.child_rating] || 'unknown';
}
function esc(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render() {
  const query = searchEl.value.trim().toLocaleLowerCase('ru');
  const selectedCategories = new Set([...categoriesEl.querySelectorAll('input[data-category]:not([data-subcategory]):checked')].map(x => x.dataset.category));
  const selectedSubcategories = new Set([...categoriesEl.querySelectorAll('input[data-subcategory]:checked')].map(x => x.dataset.category + ':' + x.dataset.subcategory));
  const child = childEl.value;
  const selectedPriorities = new Set([...document.querySelectorAll('input[data-priority]:checked')].map(x => x.dataset.priority));
  const visible = allPlaces.filter(p => {
    const hay = [p.name,p.category,p.description,p.child_suitability].join(' ').toLocaleLowerCase('ru');
    return (!query || hay.includes(query)) && (selectedCategories.has(p.category) || (subcategories[p.category] || []).some(sub => selectedSubcategories.has(p.category + ':' + sub.id))) && (!subcategories[p.category] || selectedSubcategories.has(p.category + ':' + p.subcategory)) && (child === 'all' || childClass(p) === child) && (!p.visit_priority || selectedPriorities.has(p.visit_priority));
  });
  document.getElementById('count').textContent = visible.length;
  placesEl.innerHTML = visible.map(p => `<article class="place" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${esc(categoryInfo(p.category).label)}</small><small class="child">${esc(p.child_suitability || 'Детская пригодность не оценена')}</small></article>`).join('') || '<div class="hint">По заданным фильтрам ничего не найдено.</div>';
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
    categoriesEl.innerHTML = categories.map(categoryFilterMarkup).join('');
    allPlaces.forEach(p => {
      const marker = L.marker([p.latitude,p.longitude], { icon: markerIcon(p.category, p.subcategory, p.visit_priority) });
      marker.bindPopup(`<div class="popup-title">${esc(p.name)}</div><div class="popup-priority ${priorityInfo(p.visit_priority).className}">${esc(priorityInfo(p.visit_priority).label)}</div><div class="popup-meta">${esc(categoryInfo(p.category).label + (p.subcategory ? ' · ' + ((subcategories[p.category] || []).find(s => s.id === p.subcategory)?.label || p.subcategory) : ''))}</div><div class="popup-description">${esc(p.description || '')}</div><div class="popup-child">${esc(p.child_suitability || 'Детская пригодность не оценена')}</div><a class="popup-link" target="_blank" rel="noopener" href="${googleMapsUrl(p)}">Открыть в Google Maps ↗</a>`);
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
document.querySelectorAll('input[data-priority]').forEach(el => el.addEventListener('change', render));
categoriesEl.addEventListener('change', e => {
  const input = e.target;
  if (!input.matches('input[data-category]')) return;
  const categoryId = input.dataset.category;
  if (!input.dataset.subcategory) categoriesEl.querySelectorAll('input[data-category="' + categoryId + '"][data-subcategory]').forEach(child => { child.checked = input.checked; });
  else syncCategoryCheckbox(categoryId);
  render();
});
placesEl.addEventListener('click', e => { const card = e.target.closest('.place'); if (card) focusPlace(card.dataset.id); });
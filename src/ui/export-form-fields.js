// Paylaşılabilir HTML ve KMZ dışa aktarma ekranlarının ortak alanları:
// pin seçimi (Tümü/listeden seç) ve kalite seçimi.

/**
 * @param {Array<{pin: import('../db.js').Pin, cover: import('../db.js').Photo|undefined, count: number}>} summaries
 */
export function createScopeSection(summaries) {
  const section = document.createElement('div');
  section.className = 'export-section';
  const title = document.createElement('h3');
  title.className = 'export-section-title';
  title.textContent = 'Hangi pinler?';
  section.appendChild(title);

  const allLabel = document.createElement('label');
  allLabel.className = 'export-radio-label';
  allLabel.innerHTML = `<input type="radio" name="export-scope" value="all" checked><span class="export-row-label">Tümü (${summaries.length} pin)</span><span class="export-row-check" aria-hidden="true">✓</span>`;

  const selectedLabel = document.createElement('label');
  selectedLabel.className = 'export-radio-label';
  selectedLabel.innerHTML = '<input type="radio" name="export-scope" value="selected"><span class="export-row-label">Listeden seç</span><span class="export-row-check" aria-hidden="true">✓</span>';

  const rowGroup = document.createElement('div');
  rowGroup.className = 'export-row-group';
  rowGroup.append(allLabel, selectedLabel);
  section.appendChild(rowGroup);

  const pinList = document.createElement('div');
  pinList.className = 'export-pin-list';
  pinList.hidden = true;
  for (const s of summaries) {
    const label = document.createElement('label');
    label.className = 'export-pin-item';
    const name = s.pin.title || `Pin (${s.pin.lat.toFixed(4)}, ${s.pin.lng.toFixed(4)})`;
    const safeName = name.replace(/</g, '&lt;');
    label.innerHTML = `<input type="checkbox" value="${s.pin.id}" checked><span class="export-row-label">${safeName} — ${s.count} fotoğraf</span><span class="export-row-checkbox" aria-hidden="true"></span>`;
    pinList.appendChild(label);
  }
  section.appendChild(pinList);

  const scopeRadios = Array.from(section.querySelectorAll('input[name="export-scope"]'));
  function syncVisibility() {
    pinList.hidden = scopeRadios.find((r) => r.checked)?.value !== 'selected';
  }
  scopeRadios.forEach((r) => r.addEventListener('change', syncVisibility));

  function getSelectedPinIds() {
    if (scopeRadios.find((r) => r.checked)?.value === 'all') return null;
    return Array.from(pinList.querySelectorAll('input[type=checkbox]:checked')).map((cb) => cb.value);
  }

  return { section, pinList, getSelectedPinIds, onChange: (fn) => { scopeRadios.forEach((r) => r.addEventListener('change', fn)); pinList.addEventListener('change', fn); } };
}

export function createQualitySection() {
  const section = document.createElement('div');
  section.className = 'export-section';
  const title = document.createElement('h3');
  title.className = 'export-section-title';
  title.textContent = 'Kalite';
  section.appendChild(title);

  const options = [
    { value: 'low', label: 'Küçük (800px)' },
    { value: 'medium', label: 'Orta (1024px, önerilen)' },
    { value: 'high', label: 'Yüksek (1600px)' },
  ];
  const rowGroup = document.createElement('div');
  rowGroup.className = 'export-row-group';
  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'export-radio-label';
    label.innerHTML = `<input type="radio" name="export-quality" value="${opt.value}" ${opt.value === 'medium' ? 'checked' : ''}><span class="export-row-label">${opt.label}</span><span class="export-row-check" aria-hidden="true">✓</span>`;
    rowGroup.appendChild(label);
  }
  section.appendChild(rowGroup);

  function getQuality() {
    return section.querySelector('input[name="export-quality"]:checked').value;
  }
  function onChange(fn) {
    section.querySelectorAll('input[name="export-quality"]').forEach((r) => r.addEventListener('change', fn));
  }

  return { section, getQuality, onChange };
}

/** @param {string} placeholder */
export function createTitleSection(placeholder) {
  const section = document.createElement('div');
  section.className = 'export-section';
  const title = document.createElement('h3');
  title.className = 'export-section-title';
  title.textContent = 'Başlık (opsiyonel)';
  section.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'export-title-input';
  input.placeholder = placeholder;
  section.appendChild(input);

  return { section, getTitle: () => input.value.trim() };
}

// The climate figure. The monthly averages are written once, as a table in the
// page. This draws them as three bands over one row of months, and leaves the
// table to readers who cannot see the drawing.

// Each band plots some of the table's value columns, counted from 0, on a scale
// that runs from zero to `top`.
const bands = [
  { name: 'Temperatura media, °C', kind: 'lines', columns: [0, 1], top: 34 },
  { name: 'Lluvia, mm en 31 días', kind: 'bars', columns: [2], top: 150 },
  { name: 'Cielo nublado o mayormente nublado, %', kind: 'meters', columns: [3], top: 100 },
];
const tones = ['var(--warm)', 'var(--cool)'];
const svgNS = 'http://www.w3.org/2000/svg';

export function startClimate() {
  const figure = document.querySelector('.clima__fig');
  const table = figure.querySelector('.chart-data');
  const comfort = figure.querySelector('.chart-comfort');
  const heads = [...table.tHead.rows[0].cells].slice(1).map((cell) => cell.textContent);
  const months = [...table.tBodies[0].rows].map((row) => ({
    name: row.cells[0].textContent,
    cells: [...row.cells].slice(1),
  }));

  // Everything that belongs to one month, so reading a month can light it up.
  const marks = months.map(() => []);
  const mark = (month, className, text) => {
    const element = el('span', className, text);
    element.style.setProperty('--m', month);
    marks[month].push(element);
    return element;
  };

  const plots = el('div', 'chart__plots');
  plots.setAttribute('aria-hidden', 'true');
  const stack = el('div', 'chart__bands');

  for (const band of bands) {
    const name = el('p', 'chart__name', band.name);
    const plot = el('div', `chart__plot chart__plot--${band.kind}`);

    band.columns.forEach((column, series) => {
      const height = (month) => Number(months[month].cells[column].textContent) / band.top;

      if (band.kind === 'lines') {
        const [label] = heads[column].split(',');
        const key = el('span', 'chart__key', label);
        key.style.setProperty('--tone', tones[series]);
        name.append(key);
        plot.append(line(months.map((_, month) => height(month)), tones[series]));
      }

      months.forEach(({ cells }, month) => {
        const cell = cells[column];
        // The upper line is labelled above its points, the lower one beneath.
        const value = mark(month, `chart__value${series ? ' chart__value--under' : ''}`, cell.textContent);
        const point = mark(month, band.kind === 'lines' ? 'chart__dot' : `chart__bar chart__bar--${band.kind}`);
        for (const element of [value, point]) {
          element.style.setProperty('--v', height(month));
          element.style.setProperty('--tone', tones[series]);
          // A value the sheet calls out is shown without being asked for.
          element.toggleAttribute('data-call', cell.hasAttribute('data-call'));
        }
        plot.append(point, value);
      });
    });

    const section = el('div', 'chart__band');
    section.append(name, plot);
    stack.append(section);
  }

  const axis = el('div', 'chart__months');
  months.forEach(({ name }, month) => axis.append(mark(month, '', name[0])));
  const cursor = el('span', 'chart__cursor');
  stack.append(cursor);
  plots.append(stack, axis, spans(comfort));

  // The months as a slider: the keyboard's and the screen reader's way in.
  const slider = el('input', 'chart__month');
  Object.assign(slider, { type: 'range', min: 1, max: months.length, step: 1, value: 1 });
  slider.setAttribute('aria-label', 'Mes');
  // "Enero: máxima 31 °C, mínima 20 °C, ..." from headings written "Máxima, °C".
  const spoken = (month) => {
    const values = months[month].cells.map((cell, column) => {
      const [label, unit] = heads[column].split(', ');
      return `${label.toLowerCase()} ${cell.textContent} ${unit}`;
    });
    return `${months[month].name}: ${values.join(', ')}`;
  };

  const chart = el('div', 'chart');
  chart.append(plots, slider);

  // Reads one month across the three bands, or none.
  function read(month) {
    chart.classList.toggle('is-reading', month !== null);
    marks.forEach((group, i) => group.forEach((element) => element.classList.toggle('is-on', i === month)));
    if (month === null) return;
    cursor.style.setProperty('--m', month);
    slider.value = month + 1;
    slider.setAttribute('aria-valuetext', spoken(month));
  }

  const monthAt = (event) => {
    const { left, width } = plots.getBoundingClientRect();
    const month = Math.floor(((event.clientX - left) / width) * months.length);
    return Math.max(0, Math.min(months.length - 1, month));
  };
  plots.addEventListener('pointermove', (event) => read(monthAt(event)));
  plots.addEventListener('pointerdown', (event) => read(monthAt(event)));
  // A finger has no hover to end: its reading stays until a touch elsewhere.
  plots.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') read(null);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!plots.contains(event.target)) read(null);
  });
  slider.addEventListener('input', () => read(slider.value - 1));
  slider.addEventListener('focus', () => read(slider.value - 1));
  slider.addEventListener('blur', () => read(null));

  slider.setAttribute('aria-valuetext', spoken(0));
  figure.prepend(chart);
  // A table does not shrink to a box it is told to, so its wrapper is what is put away.
  figure.querySelector('.chart-source').classList.add('sr-only');
}

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// One series as a line through the middle of each month. The drawing is stretched
// to its plot, so the stroke is kept from stretching with it.
function line(heights, tone) {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${heights.length} 1`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS(svgNS, 'polyline');
  path.setAttribute('points', heights.map((height, month) => `${month + 0.5},${1 - height}`).join(' '));
  path.style.stroke = tone;
  svg.append(path);
  return svg;
}

// The stretches of the year named in a note, as brackets under the months.
// data-months gives each as "from-to", counted in months from the start of January.
function spans(note) {
  const row = el('div', 'chart__spans');
  const edges = note.dataset.months.split(' ').map((span) => span.split('-').map(Number));
  for (const [from, to] of edges) {
    const bracket = el('span', 'chart__span');
    bracket.style.setProperty('--from', from);
    bracket.style.setProperty('--to', to);
    row.append(bracket);
  }
  // The label sits in the gap between the first stretch and the second.
  const label = el('span', 'chart__span-label', note.dataset.label);
  label.style.setProperty('--at', (edges[0][1] + edges[1][0]) / 2);
  row.append(label);
  return row;
}

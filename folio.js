import { enter, reduced } from './motion.js';

export function startFolio() {
  const sheets = [...document.querySelectorAll('[data-sheet]')];
  const folio = document.querySelector('.folio');
  const two = (n) => String(n).padStart(2, '0');
  const number = document.createElement('span');
  folio.append(number, ` / ${two(sheets.length)}`);
  let current = 0;

  const crossing = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const next = sheets.indexOf(entry.target) + 1;
        number.textContent = two(next);
        if (current) roll(number, next > current);
        current = next;
        folio.hidden = false;
      }
    },
    // A zero-height band at mid-screen: the sheet crossing it is the one being read.
    { rootMargin: '-50% 0px -50% 0px' },
  );
  sheets.forEach((sheet) => crossing.observe(sheet));
}

// The new number rolls in the way a counter turns: up into place going forward,
// down going back. The folio is set sideways, so the glyphs' up is the screen's right.
function roll(number, forward) {
  if (reduced) {
    enter(number, { opacity: [0, 1] }, { duration: 0.12 });
    return;
  }
  enter(
    number,
    { opacity: [0, 1], transform: [`translateX(${forward ? -0.5 : 0.5}em)`, 'translateX(0)'] },
    { duration: 0.2 },
  );
}

import { scroll } from './vendor/motion.js';

// The three plans are cut from one window around the lot, so they register. Laid
// over each other and held on screen, scrolling goes up through the house a level
// at a time. Without this module they are three drawings one after the other.
export function startLevels() {
  const track = document.querySelector('.levels');
  const pin = track.querySelector('.levels__pin');
  const levels = [...track.querySelectorAll('.fig')];
  let current = -1;

  function show(level) {
    if (level === current) return;
    current = level;
    levels.forEach((figure, i) => {
      figure.classList.toggle('is-current', i === level);
      figure.classList.toggle('is-above', i > level);
      // Only the plan on top can be opened or focused.
      figure.inert = i !== level;
    });
  }

  show(0);
  track.classList.add('is-live');
  scroll((progress) => show(Math.min(levels.length - 1, Math.floor(progress * levels.length))), {
    target: track,
    offset: ['start start', 'end end'],
  });

  // The viewer can step onto a plan that is not the one showing. The page goes to
  // that level behind it, so the drawing has its own plan to land on when it closes.
  document.addEventListener('viewer:step', (event) => {
    const level = levels.findIndex((figure) => figure.contains(event.detail.trigger));
    if (level < 0) return;
    const start = track.getBoundingClientRect().top + scrollY;
    const travel = track.offsetHeight - pin.offsetHeight;
    scrollTo({ top: start + ((level + 0.5) / levels.length) * travel, behavior: 'instant' });
    show(level);
  });
}

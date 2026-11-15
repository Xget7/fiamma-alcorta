// Entrances, each played once per page load, as the reader reaches them: the name
// and the titles are set line by line, each drawing is unrolled from its top edge,
// the climate figure is plotted month by month, and the graphic scales measure
// themselves out.
import { animate, inView, stagger } from './vendor/motion.js';

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;
const ease = [0.16, 1, 0.3, 1];
// A line starts just below its mask, clear of the clip's reach in motion.css.
const belowMask = 'translateY(calc(100% + 0.3em))';
// Seen once a little inside the bottom edge, so the entrance is watched whole.
const seen = { margin: '0px 0px -12% 0px' };
// A scale bar sits under its drawing. Under one that fills the screen and is held
// there, the plans, it never climbs as high as that, so it is seen nearer the edge.
const seenLow = { margin: '0px 0px -4% 0px' };

export function startMotion() {
  // The early script in <head> hides what is about to move. If its class is gone,
  // the page has already been shown as it is, and hiding anything now would flash.
  if (!root.classList.contains('motion-pending')) return;

  const cover = document.querySelector('.cover');
  const coverImage = cover.querySelector('img');

  // A drawing is an image that opens in the viewer, or a plate, which may be an
  // image with marks over it or drawn in the page with no image at all.
  for (const drawing of document.querySelectorAll('.zoom img, .plate')) {
    const image = drawing.matches('img') ? drawing : drawing.querySelector('img');
    if (reduced) {
      if (image) appear(image);
      continue;
    }
    // The cover drawing arrives with its sheet instead.
    if (image === coverImage) continue;
    whenSeen(drawing, () => (image ? decoded(image) : Promise.resolve()).then(() => unroll(drawing)));
  }

  if (!reduced) {
    // Lines can only be found once their face has loaded. Wait for it, but not for long.
    const typeset = Promise.race([
      document.fonts.load('1em Chivo').catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    layCover(cover, typeset);
    for (const title of document.querySelectorAll('h2')) {
      whenSeen(title, () => typeset.then(() => setLines([title])));
    }
    for (const bar of document.querySelectorAll('.bar')) {
      whenSeen(bar, () => drawBar(bar), seenLow);
    }
    for (const chart of document.querySelectorAll('.chart__plots')) {
      whenSeen(chart, () => plot(chart));
    }
  }

  root.classList.remove('motion-pending');
}

// Plays an entrance from the first keyframe of each value, then hands the elements
// back to the stylesheet. The first keyframe is written inline at once because
// Motion starts on the next frame, and the final state must not show before it.
// Motion writes the final values once more when it next renders, so they are
// cleared a frame later.
export function enter(targets, keyframes, options) {
  const elements = [].concat(targets);
  for (const element of elements) {
    for (const [property, [from]] of Object.entries(keyframes)) {
      element.style.setProperty(property, from);
    }
    release(element);
  }
  return animate(elements, keyframes, { ease, ...options })
    .finished.then(() => new Promise(requestAnimationFrame))
    .then(() => {
      for (const element of elements) {
        for (const property in keyframes) element.style.removeProperty(property);
        if (!element.style.length) element.removeAttribute('style');
      }
    });
}

// [data-enter] keeps an element out of sight until its entrance plays (motion.css).
function hold(element) {
  element.dataset.enter = '';
}

function release(element) {
  delete element.dataset.enter;
}

function whenSeen(element, play, where = seen) {
  hold(element);
  // The callback returns nothing, so Motion stops watching after the first time.
  inView(element, () => {
    play();
  }, where);
}

// A drawing is unrolled onto the page from its top edge, once it can be painted
// whole. The right-hand drawing of a pair follows the left.
function unroll(drawing) {
  const figure = drawing.closest('.pair > .fig');
  const column = figure ? [...figure.parentElement.children].indexOf(figure) % 2 : 0;
  return enter(
    drawing,
    { 'clip-path': ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] },
    { duration: 0.9, delay: column * 0.09 },
  );
}

// A chart is plotted the way it is read, from its first month to its last. The
// clip reaches past the box, so a value written beyond an edge is not cut.
function plot(chart) {
  return enter(
    chart,
    { 'clip-path': ['inset(-2rem 100% -2rem -2rem)', 'inset(-2rem -2rem -2rem -2rem)'] },
    { duration: 1.1 },
  );
}

// Without motion, a drawing still loading fades in instead of popping in. One
// already loaded is simply there.
function appear(image) {
  if (image.complete) return;
  hold(image);
  decoded(image).then(() => enter(image, { opacity: [0, 1] }, { duration: 0.15, ease: 'easeOut' }));
}

// Resolves once the image can be painted whole, or has failed and never will.
function decoded(image) {
  const loaded = image.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
  return loaded.then(() => image.decode()).catch(() => {});
}

// The sheet is laid on the table: the name is set, the drawing settles as soon as
// it can be painted, without waiting for the text, then the contents and caption.
function layCover(cover, typeset) {
  const identity = [...cover.querySelectorAll('.cover__id > *')];
  const links = [...cover.querySelectorAll('.cover__nav a')];
  const figure = cover.querySelector('.cover__fig');
  [...identity, ...links, figure].forEach(hold);

  typeset.then(() => {
    setLines(identity);
    enter(links, { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.06, { startDelay: 0.45 }) });
  });

  decoded(figure.querySelector('img')).then(() => {
    enter(
      figure,
      { opacity: [0, 1], transform: ['translateY(1.5rem)', 'translateY(0)'] },
      { duration: 0.9 },
    );
    const caption = figure.querySelector('figcaption');
    if (caption) enter(caption, { opacity: [0, 1] }, { duration: 0.5, delay: 0.45 });
  });
}

// Sets each rendered line of the blocks from behind its own lower edge, then puts
// the authored markup back, so the text reflows freely again afterwards.
function setLines(blocks) {
  const sources = blocks.map((block) => block.innerHTML);
  const lines = blocks.flatMap(splitLines);
  const done = enter(
    lines,
    { transform: [belowMask, 'translateY(0)'] },
    { duration: 0.7, delay: stagger(0.08) },
  );
  blocks.forEach(release);
  return done.then(() => {
    blocks.forEach((block, i) => {
      block.innerHTML = sources[i];
    });
  });
}

// Rebuilds the block as one masked line per line it renders as now, and returns
// the lines. Each word goes back inside copies of the inline elements it sat in,
// so the bold word stays bold.
function splitLines(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);

  const words = texts.flatMap((text) => {
    const spans = text.data.split(/(?<=\s)(?=\S)/).map((part) => {
      const span = document.createElement('span');
      span.textContent = part;
      return span;
    });
    text.replaceWith(...spans);
    return spans;
  });

  // A word starts a new line when it sits lower than the middle of the current one.
  // Collapsed whitespace has no width and stays with the line it follows.
  const lines = [[]];
  let lineTop = null;
  for (const word of words) {
    const { top, height, width } = word.getBoundingClientRect();
    if (width && (lineTop === null || top > lineTop + height / 2)) {
      if (lineTop !== null) lines.push([]);
      lineTop = top;
    }
    lines.at(-1).push(word);
  }

  const masks = lines.map((line) => {
    const mask = document.createElement('span');
    const content = document.createElement('span');
    mask.className = 'line';
    content.append(...line.map((word) => insideOriginalInlines(word, block)));
    mask.append(content);
    return mask;
  });
  block.replaceChildren(...masks);
  return masks.map((mask) => mask.firstChild);
}

function insideOriginalInlines(word, block) {
  let node = word.firstChild;
  for (let parent = word.parentNode; parent !== block; parent = parent.parentNode) {
    const copy = parent.cloneNode(false);
    copy.append(node);
    node = copy;
  }
  return node;
}

// The scale bar measures itself out to its true length, and its dimension is
// written as it gets there.
function drawBar(bar) {
  const label = document.createElement('span');
  label.append(...bar.childNodes);
  bar.append(label);
  return Promise.all([
    enter(bar, { '--drawn': [0, 1] }, { duration: 0.7 }),
    enter(label, { opacity: [0, 1] }, { duration: 0.25, delay: 0.5 }),
  ]).then(() => label.replaceWith(...label.childNodes));
}

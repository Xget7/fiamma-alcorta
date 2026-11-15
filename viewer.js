import { animate } from './vendor/motion.js';

// Durations in seconds. Exits are quicker than entrances.
const OPEN = 0.42;
const CLOSE = 0.28;
const ZOOM = 0.3;
const STEP = 0.2;
const QUICK = 0.12; // every change under reduced motion
// Decelerates hard and never overshoots: the sheet lands, it does not bounce.
const GLIDE = [0.16, 1, 0.3, 1];
// How far a press may travel and still count as a click.
const SLOP = 6;

// The enlarged drawing. The viewer is in one of three states, closed, fitted or
// zoomed. The drawing on screen is a sheet: an <img> laid out at its resting size
// (fitted or full resolution) and moved by a transform from `box`, the rectangle
// it covers on screen right now. Every animation tweens `box` with Motion, so any
// action can start from wherever the last one left the drawing.
export function startViewer() {
  const viewer = document.querySelector('.viewer');
  const paper = viewer.querySelector('.viewer__paper');
  const closer = viewer.querySelector('.viewer__close');
  const triggers = [...document.querySelectorAll('.zoom')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let state = 'closed';
  let sheet = null;
  let press = null;
  let dragged = false;

  function open(trigger) {
    const from = thumbOf(trigger).getBoundingClientRect();
    viewer.showModal();
    state = 'fitted';
    announce('viewer:open');
    sheet = createSheet(trigger, from);
    if (reduced.matches) {
      place(sheet, sheet.fit);
      fade([sheet.img], [0, 1], QUICK);
      fade([paper, closer], [0, 1], QUICK);
    } else {
      glide(sheet, sheet.fit, OPEN);
      fade([paper, closer], [0, 1], 0.3);
    }
    mark();
  }

  async function close() {
    if (state === 'closed') return;
    state = 'closed';
    announce('viewer:close');
    mark();
    const leaving = sheet;
    const home = thumbOf(leaving.trigger).getBoundingClientRect();
    const duration = reduced.matches ? QUICK : CLOSE;
    fade([paper, closer], 0, duration);
    if (!reduced.matches && onScreen(home)) await glide(leaving, home, duration);
    else await fade([leaving.img], 0, duration);
    if (sheet === leaving) finish();
  }

  // Closes at once, for when the browser closes the dialog without waiting for us.
  function shut() {
    if (state !== 'closed') {
      state = 'closed';
      announce('viewer:close');
    }
    if (sheet) finish();
  }

  // Puts the page back in the same frame the dialog goes away, so the thumbnail
  // is never missing.
  function finish() {
    const { trigger } = sheet;
    sheet.tween?.stop();
    for (const img of viewer.querySelectorAll('.viewer__drawing')) img.remove();
    trigger.removeAttribute('data-lifted');
    sheet = null;
    press = null;
    mark();
    if (viewer.open) viewer.close();
    trigger.focus({ preventScroll: true });
  }

  function step(direction) {
    if (state === 'closed') return;
    const next = triggers[triggers.indexOf(sheet.trigger) + direction];
    if (!next) return;
    announce('viewer:step', { trigger: next });
    const duration = reduced.matches ? QUICK : STEP;
    retire(sheet, duration);
    // Bring the thumbnail of the drawing on screen into view behind the paper,
    // so closing lands on it.
    if (!inView(next.getBoundingClientRect())) next.scrollIntoView({ block: 'center', behavior: 'instant' });
    state = 'fitted';
    sheet = createSheet(next);
    fade([sheet.img], [0, 1], duration);
    mark();
  }

  function retire(old, duration) {
    old.tween?.stop();
    old.trigger.removeAttribute('data-lifted');
    old.img.classList.add('is-leaving');
    fade([old.img], 0, duration).then(() => old.img.remove());
  }

  function toggleZoom(point) {
    if (state === 'zoomed') zoomOut();
    else if (canZoom(sheet)) zoomIn(point);
  }

  // Goes to one image pixel per CSS pixel, keeping the clicked point under the cursor.
  function zoomIn(point) {
    state = 'zoomed';
    announce('viewer:zoom', { zoomed: true });
    mark();
    const { box, full } = sheet;
    const x = (point.x - box.left) / box.width;
    const y = (point.y - box.top) / box.height;
    const target = clamp(sheet, {
      left: Math.round(point.x - x * full.width),
      top: Math.round(point.y - y * full.height),
      width: full.width,
      height: full.height,
    });
    resize(sheet, full);
    glide(sheet, target, reduced.matches ? 0 : ZOOM);
  }

  function zoomOut() {
    state = 'fitted';
    announce('viewer:zoom', { zoomed: false });
    mark();
    resize(sheet, sheet.fit);
    glide(sheet, sheet.fit, reduced.matches ? 0 : ZOOM);
  }

  function createSheet(trigger, from) {
    const thumb = thumbOf(trigger);
    const img = new Image();
    img.className = 'viewer__drawing';
    img.alt = thumb.alt;
    img.draggable = false;
    // The thumbnail is already decoded, so it shows from the first frame.
    img.src = thumb.currentSrc || trigger.dataset.full;
    const aspect = aspectOf(thumb);
    const fit = fitBox(aspect);
    const box = from ?? fit;
    const created = { trigger, img, aspect, fit, size: sizeOf(fit), box, goal: box, full: null, tween: null };
    render(created);
    paper.after(img);
    trigger.setAttribute('data-lifted', '');
    loadFull(created);
    return created;
  }

  // Swaps in the full file once it has decoded. The sheet keeps its laid out
  // size, so nothing moves. If the file fails, the thumbnail simply stays.
  function loadFull(target) {
    const loader = new Image();
    loader.src = target.trigger.dataset.full;
    loader.decode().then(
      () => {
        if (target !== sheet) return;
        target.img.src = loader.src;
        target.full = { width: loader.naturalWidth, height: loader.naturalHeight };
        mark();
      },
      () => {},
    );
  }

  // The drawing fills the screen, centred, inset by the margin the close button
  // keeps from the edge. One too large to pass the button keeps that margin from
  // it too, beside it or below it, whichever leaves the drawing larger.
  function fitBox(aspect) {
    const button = closer.getBoundingClientRect();
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;
    const margin = width - button.right;
    const centred = (room, roomHeight) => {
      const w = Math.min(room, roomHeight * aspect);
      const h = w / aspect;
      return {
        left: Math.round((width - w) / 2),
        top: Math.round((height - h) / 2),
        width: Math.round(w),
        height: Math.round(h),
      };
    };
    const free = centred(width - 2 * margin, height - 2 * margin);
    if (free.top >= button.bottom || free.left + free.width <= button.left) return free;
    const beside = centred(2 * button.left - width - 2 * margin, height - 2 * margin);
    const below = centred(width - 2 * margin, height - 2 * (button.bottom + margin));
    return beside.width > below.width ? beside : below;
  }

  // When zoomed the drawing always covers the place it sat fitted, so it can
  // never be dragged away, and zooming in about any point of it needs no correction.
  function clamp({ fit }, box) {
    return {
      ...box,
      left: within(box.left, fit.left + fit.width - box.width, fit.left),
      top: within(box.top, fit.top + fit.height - box.height, fit.top),
    };
  }

  // Resolves to whether this glide ran to its end rather than being replaced.
  async function glide(target, to, duration) {
    target.tween?.stop();
    target.tween = null;
    target.goal = to;
    if (!duration) {
      place(target, to);
      return true;
    }
    const from = target.box;
    const tween = animate(0, 1, {
      duration,
      ease: GLIDE,
      autoplay: false,
      onUpdate: (t) => place(target, mix(from, to, t)),
    });
    target.tween = tween;
    // Motion dates a tween from the moment it is made, and this curve covers a
    // tenth of the way in its first 16 ms. Starting on the next frame paints the
    // drawing where it is first, so it never jumps off its thumbnail.
    requestAnimationFrame(() => tween.play());
    await tween;
    const ended = target.tween === tween;
    if (ended) target.tween = null;
    return ended;
  }

  // Finishes a running glide at once, so a drag starts from a sheet at rest.
  function settle(target) {
    if (!target.tween) return;
    target.tween.stop();
    target.tween = null;
    place(target, target.goal);
  }

  function place(target, box) {
    target.box = box;
    render(target);
  }

  // Changes the laid out size without moving the picture on screen.
  function resize(target, size) {
    target.size = sizeOf(size);
    render(target);
  }

  function render({ img, box, size }) {
    img.style.width = `${size.width}px`;
    img.style.height = `${size.height}px`;
    img.style.transform = `translate(${box.left}px, ${box.top}px) scale(${box.width / size.width})`;
  }

  function fade(elements, opacity, duration) {
    if (Array.isArray(opacity)) for (const element of elements) element.style.opacity = opacity[0];
    return animate(elements, { opacity }, { duration, ease: 'easeOut' });
  }

  function mark() {
    viewer.dataset.state = state;
    viewer.toggleAttribute('data-zoomable', state === 'fitted' && canZoom(sheet));
  }

  function announce(type, detail) {
    document.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }

  function onScreen(rect) {
    return rect.bottom > 0 && rect.right > 0 && rect.top < viewer.clientHeight && rect.left < viewer.clientWidth;
  }

  function inView(rect) {
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewer.clientHeight && rect.right <= viewer.clientWidth;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.zoom');
    if (trigger && !viewer.open) open(trigger);
  });

  closer.addEventListener('click', close);

  viewer.addEventListener('click', (event) => {
    // The second click of a double click carries the first one's intent. It must
    // not undo a zoom, nor close or zoom a drawing still flying open from the page.
    if (event.detail > 1) return;
    if (event.target === paper) close();
    else if (event.target === sheet?.img && !dragged) toggleZoom({ x: event.clientX, y: event.clientY });
  });

  viewer.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    step(direction);
  });

  // Escape: our own close when the browser lets us take it over, otherwise the
  // browser's, with the page restored in the same frame.
  viewer.addEventListener('cancel', (event) => {
    if (state !== 'closed' && event.cancelable) {
      event.preventDefault();
      close();
    } else {
      shut();
    }
  });

  viewer.addEventListener('close', shut);

  viewer.addEventListener('pointerdown', (event) => {
    dragged = false;
    if (state === 'closed' || event.target !== sheet.img || !event.isPrimary || event.button !== 0) return;
    if (state === 'zoomed') settle(sheet);
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, left: sheet.box.left, top: sheet.box.top };
    sheet.img.setPointerCapture(event.pointerId);
  });

  viewer.addEventListener('pointermove', (event) => {
    if (press?.id !== event.pointerId) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!dragged) {
      if (Math.hypot(dx, dy) < SLOP) return;
      dragged = true;
      viewer.toggleAttribute('data-dragging', state === 'zoomed');
    }
    if (state !== 'zoomed') return;
    // The full distance from the press, so the grabbed point stays under the pointer.
    place(sheet, clamp(sheet, { ...sheet.box, left: Math.round(press.left + dx), top: Math.round(press.top + dy) }));
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    viewer.addEventListener(type, (event) => {
      if (press?.id !== event.pointerId) return;
      press = null;
      viewer.removeAttribute('data-dragging');
    });
  }

  // A new screen size gets a new fit; a drawing being read zoomed goes back to fitted.
  addEventListener('resize', () => {
    if (state === 'closed') return;
    const fit = fitBox(sheet.aspect);
    if (sameBox(fit, sheet.fit)) return;
    sheet.fit = fit;
    state = 'fitted';
    resize(sheet, fit);
    glide(sheet, fit, 0);
    mark();
  });
}

function thumbOf(trigger) {
  return trigger.querySelector('img');
}

function aspectOf(thumb) {
  if (thumb.naturalWidth) return thumb.naturalWidth / thumb.naturalHeight;
  const { width, height } = thumb.getBoundingClientRect();
  return width / height;
}

function canZoom(sheet) {
  return Boolean(sheet?.full) && sheet.full.width > sheet.fit.width;
}

function sizeOf({ width, height }) {
  return { width, height };
}

function mix(from, to, t) {
  return {
    left: from.left + (to.left - from.left) * t,
    top: from.top + (to.top - from.top) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

function within(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sameBox(a, b) {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

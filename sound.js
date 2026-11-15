// Interface sounds for the drawing set: paper and pencil on a drafting table,
// synthesized at play time from filtered noise and short damped tones.

const KEY = 'fiamma:sound';

// One knob for the whole set. Recipe levels are relative to it, so the loudest
// cue peaks near -20 dBFS: well under speech or music playing alongside.
const MASTER_DB = -15;

// Scheduling slightly ahead keeps every envelope starting from silence, even if
// the audio thread has moved on by the time the nodes are created.
const LOOKAHEAD = 0.01;

// Key auto-repeat fires every 30 ms or so; stacking the same cue that fast
// would only make it louder.
const REPEAT_GAP = 0.04;

// A cue that waited this long for the context to resume belongs to a past
// gesture; playing it late would be wrong.
const STALE_MS = 250;

// Each cue is a recipe on a Voice. Offsets and durations are in seconds,
// frequencies in hertz, levels in dB relative to MASTER_DB.
const cues = {
  // A sheet lifted and laid down: a rising swish, then the paper settling.
  open(v) {
    v.hiss(0, { dur: 0.15, filter: 'bandpass', from: 650, to: 2300, q: 0.8, rise: 0.06, level: 0 });
    v.hiss(0.11, { dur: 0.04, filter: 'lowpass', from: 700, q: 0.7, rise: 0.008, level: -7 });
  },

  // The sheet put back: shorter, lower, falling, quieter.
  close(v) {
    v.hiss(0, { dur: 0.11, filter: 'bandpass', from: 1300, to: 480, q: 0.8, rise: 0.035, level: -4 });
    v.hiss(0.075, { dur: 0.035, filter: 'lowpass', from: 550, q: 0.7, rise: 0.006, level: -11 });
  },

  // Pencil ticks: a scratch of graphite with the knock of the table under it.
  zoomIn(v) {
    v.hiss(0, { dur: 0.04, filter: 'bandpass', from: 3600, to: 3000, q: 1.4, rise: 0.002, level: -5 });
    v.knock(0, { dur: 0.035, freq: 520, level: -18 });
  },

  zoomOut(v) {
    v.hiss(0, { dur: 0.045, filter: 'bandpass', from: 2300, to: 1900, q: 1.4, rise: 0.002, level: -6 });
    v.knock(0, { dur: 0.04, freq: 380, level: -18 });
  },

  // A page edge flicked past: a quick falling swish.
  step(v) {
    v.hiss(0, { dur: 0.085, filter: 'bandpass', from: 1900, to: 900, q: 0.7, rise: 0.015, level: -6 });
  },

  // The smallest tick of the set.
  tap(v) {
    v.hiss(0, { dur: 0.022, filter: 'bandpass', from: 1800, q: 1.2, rise: 0.0015, level: -11 });
  },

  // Two soft fingertip taps on the table, the same both times so they read as
  // a gesture, not a phrase.
  on(v) {
    for (const [at, level] of [[0, -8], [0.085, -10]]) {
      v.hiss(at, { dur: 0.025, filter: 'lowpass', from: 1800, q: 0.7, rise: 0.002, level });
      v.knock(at, { dur: 0.03, freq: 300, level: level - 6 });
    }
  },
};

export function startSound(toggle) {
  if (typeof AudioContext !== 'function') return () => {};

  let on = readChoice();
  let context = null;
  const lastStart = new Map();

  const sound = (name) => {
    const at = context.currentTime + LOOKAHEAD;
    if (at - (lastStart.get(name) ?? -Infinity) < REPEAT_GAP) return;
    lastStart.set(name, at);
    scheduleCue(context, name, at);
  };

  const play = (name) => {
    if (!on || !Object.hasOwn(cues, name)) return;
    // Created on first use, so only ever inside the gesture that asked for a sound.
    if (!context || context.state === 'closed') context = createContext();
    if (context.state === 'running') {
      sound(name);
      return;
    }
    // Suspended at birth (Safari), or later by the system (tab backgrounded,
    // iOS interruption): resume, then play if the gesture is still recent.
    const asked = performance.now();
    context.resume().then(
      () => {
        if (on && performance.now() - asked < STALE_MS) sound(name);
      },
      () => {},
    );
  };

  const show = () => toggle.setAttribute('aria-pressed', String(on));

  toggle.addEventListener('click', () => {
    on = !on;
    show();
    saveChoice(on);
    if (on) play('on');
    // Let the audio hardware sleep while the visitor wants quiet.
    else context?.suspend().catch(() => {});
  });

  show();
  toggle.hidden = false;
  return play;
}

// Renders one cue into any BaseAudioContext, so the same recipes can be heard
// live or measured through an OfflineAudioContext.
export function scheduleCue(context, name, at = context.currentTime, destination = context.destination) {
  const voice = new Voice(context, destination, at);
  cues[name](voice);
  voice.release();
}

// One play of one cue. Nodes are made fresh for every play and everything
// downstream of the sources is disconnected once the last one ends, so rapid
// plays never grow the graph.
class Voice {
  constructor(context, destination, at) {
    this.context = context;
    this.at = at;
    // A few percent of pitch and level per play, so repeats are not mechanical.
    this.pitch = vary(0.04);
    this.out = new GainNode(context, { gain: dbToGain(MASTER_DB) * vary(0.08) });
    this.out.connect(destination);
    this.last = null;
    this.end = 0;
  }

  // Filtered noise: the paper. The filter glides from `from` to `to`.
  hiss(offset, { dur, filter, from, to = from, q, rise, level }) {
    const start = this.at + offset;
    const buffer = noiseFor(this.context);
    const noise = new AudioBufferSourceNode(this.context, { buffer });
    const shape = new BiquadFilterNode(this.context, { type: filter, Q: q });
    shape.frequency.setValueAtTime(from * this.pitch, start);
    shape.frequency.exponentialRampToValueAtTime(to * this.pitch, start + dur);
    noise.connect(shape).connect(this.envelope(start, dur, rise, level));
    // A different stretch of the noise every time.
    this.run(noise, start, dur, Math.random() * (buffer.duration - dur));
  }

  // A short damped sine: the table under the paper.
  knock(offset, { dur, freq, level }) {
    const start = this.at + offset;
    const tone = new OscillatorNode(this.context, { frequency: freq * this.pitch });
    tone.connect(this.envelope(start, dur, 0.002, level));
    this.run(tone, start, dur);
  }

  // A gain that swells over `rise`, then dies away, starting and ending at
  // exactly zero so nothing clicks.
  envelope(start, dur, rise, level) {
    const amp = new GainNode(this.context, { gain: 0 });
    amp.gain.setValueCurveAtTime(envelopeCurve(dur, rise, dbToGain(level)), start, dur);
    amp.connect(this.out);
    return amp;
  }

  run(source, start, dur, offset = 0) {
    source.start(start, offset);
    source.stop(start + dur);
    if (start + dur >= this.end) {
      this.end = start + dur;
      this.last = source;
    }
  }

  release() {
    this.last.addEventListener('ended', () => this.out.disconnect(), { once: true });
  }
}

const CURVE_POINTS = 128;

function envelopeCurve(dur, rise, peak) {
  const curve = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) {
    const t = (i / (CURVE_POINTS - 1)) * dur;
    if (t < rise) {
      curve[i] = peak * Math.sin((Math.PI / 2) * (t / rise)) ** 2;
    } else {
      // Exponential decay, pulled to exactly zero at the end.
      const y = (t - rise) / (dur - rise);
      curve[i] = peak * Math.exp(-4 * y) * (1 - y);
    }
  }
  return curve;
}

// One second of white noise per context, shared by every play.
const noiseBuffers = new WeakMap();

function noiseFor(context) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = new AudioBuffer({ length: context.sampleRate, sampleRate: context.sampleRate });
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

function createContext() {
  // On iOS, mix with whatever the visitor is listening to and obey the silent
  // switch, instead of taking over playback.
  if ('audioSession' in navigator) navigator.audioSession.type = 'ambient';
  return new AudioContext({ latencyHint: 'interactive' });
}

function vary(amount) {
  return 1 + (Math.random() * 2 - 1) * amount;
}

function dbToGain(db) {
  return 10 ** (db / 20);
}

function readChoice() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveChoice(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
}

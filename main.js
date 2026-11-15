import { startClimate } from './climate.js';
import { startFolio } from './folio.js';
import { startLocationMap } from './location-map.js';
import { startLevels } from './levels.js';
import { startMotion } from './motion.js';
import { startSound } from './sound.js';
import { startViewer } from './viewer.js';

startViewer();
startLevels();
startLocationMap();
// The climate figure is drawn before the entrances are set up, so it gets one too.
startClimate();
startFolio();
startMotion();

// The viewer announces what it does; the sound for each event is chosen here,
// so neither module knows about the other.
const play = startSound(document.querySelector('.sound'));
const cues = {
  'viewer:open': () => 'open',
  'viewer:close': () => 'close',
  'viewer:zoom': (event) => (event.detail.zoomed ? 'zoomIn' : 'zoomOut'),
  'viewer:step': () => 'step',
};
for (const [type, cue] of Object.entries(cues)) {
  document.addEventListener(type, (event) => play(cue(event)));
}
document.addEventListener('click', (event) => {
  if (event.target.closest('a[href^="#"]')) play('tap');
});

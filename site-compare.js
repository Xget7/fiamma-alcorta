import { createSiteCamera, parcelOutline, registerHouseToPlan } from './site-calibration.js';

export function startSiteCompare() {
  const host = document.querySelector('.site-compare');
  if (!host) return;
  const layer = host.querySelector('.site-compare__project');
  const slider = host.querySelector('input');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let center = 56.5;
  let manual = false, visible = false, ready = false, hinted = false, frame = 0;
  function setReveal(value) {
    const progress = Math.max(0, Math.min(100, value));
    host.style.setProperty('--reveal', `${progress}%`);
    slider.value = String(progress);
    slider.setAttribute('aria-valuetext', `${Math.round(progress)}% con proyecto`);
  }
  function stopHint() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function hint() {
    if (frame || !ready || !visible || manual || hinted || reduced.matches || document.hidden) return;
    let start;
    function tick(now) {
      start ??= now;
      const progress = Math.min(1, (now - start) / 4400);
      // Two restrained passes, easing back to the center of the house.
      setReveal(center + 1.2 * Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { frame = 0; hinted = true; setReveal(center); }
    }
    frame = requestAnimationFrame(tick);
  }
  function takeControl() { manual = true; stopHint(); }
  slider.addEventListener('pointerdown', takeControl);
  slider.addEventListener('focus', takeControl);
  slider.addEventListener('input', () => { takeControl(); setReveal(Number(slider.value)); });
  reduced.addEventListener('change', () => {
    stopHint();
    if (!manual) setReveal(center);
    hint();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopHint(); else hint();
  });
  setReveal(center);

  async function mount() {
    try {
      const [THREE, { createHouse }, { batchHouse }] = await Promise.all([
        import('./vendor/three.module.js'), import('./house-model.js'), import('./house-batches.js'),
      ]);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0xffffff, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      const model = createHouse();
      model.setExplosion(0);
      registerHouseToPlan(THREE, model);
      batchHouse(model.parts);
      scene.add(model.root);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7553, 2.4));
      const sun = new THREE.DirectionalLight(0xfff4df, 3);
      sun.position.set(0, 30, -2);
      sun.target.position.set(12.5, 0, 7.5);
      scene.add(sun.target);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
      sun.shadow.normalBias = .035;
      scene.add(sun);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(35, 25), new THREE.ShadowMaterial({ opacity: .22 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(12.5, -.24, 7.5);
      shadow.receiveShadow = true;
      scene.add(shadow);
      const camera = createSiteCamera(THREE);
      host.querySelector('polygon').setAttribute('points', parcelOutline().map(p => p.join(',')).join(' '));
      const footprint = new THREE.Box3();
      for (const part of model.parts) footprint.expandByObject(part.group);
      const mid = footprint.getCenter(new THREE.Vector3()).project(camera);
      center = (mid.x + 1) * 50;
      if (!manual) setReveal(center);
      layer.append(renderer.domElement);
      function draw() {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(rect.width, rect.width * 1125 / 2000, false);
        renderer.render(scene, camera);
      }
      new ResizeObserver(draw).observe(host);
      draw();
      host.classList.add('is-ready');
      ready = true;
      hint();
      renderer.domElement.addEventListener('webglcontextlost', () => {
        host.classList.remove('is-ready');
        ready = false;
        stopHint();
        layer.hidden = true;
      });
    } catch (error) {
      console.error('No se pudo cargar la implantación 3D.', error);
      ready = false;
      stopHint();
      host.classList.remove('is-ready');
    }
  }
  let started = false;
  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && !started) { started = true; mount(); }
    if (visible) hint(); else stopHint();
  });
  observer.observe(host);
}

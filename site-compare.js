// An illustrative registration to the PDF parcel, not a surveyed geolocation.
export function siteProjection(THREE) {
  const u = { x: 198 / 18, y: -27 / 18 };
  const v = { x: 82 / 36, y: 426 / 36 };
  const ox = 1000 + u.x * 11 + v.x * 10;
  const oy = 374 + u.y * 11 + v.y * 10;
  return new THREE.Matrix4().set(
    u.x / 1000, -1 / 1000, v.x / 1000, ox / 1000 - 1,
    -u.y / 562.5, 4 / 562.5, -v.y / 562.5, 1 - oy / 562.5,
    0, -.04, .002, 0,
    0, 0, 0, 1,
  );
}

export function startSiteCompare() {
  const host = document.querySelector('.site-compare');
  if (!host) return;
  const layer = host.querySelector('.site-compare__project');
  const slider = host.querySelector('input');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const center = 58;
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
      batchHouse(model.parts);
      scene.add(model.root);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7553, 2.4));
      const sun = new THREE.DirectionalLight(0xfff4df, 3);
      sun.position.set(-12, 30, -10);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
      sun.shadow.normalBias = .035;
      scene.add(sun);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(28, 32), new THREE.ShadowMaterial({ opacity: .22 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(-2, -.24, 2);
      shadow.receiveShadow = true;
      scene.add(shadow);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
      camera.projectionMatrix.copy(siteProjection(THREE));
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      layer.append(renderer.domElement);
      function draw() {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(rect.width, rect.height, false);
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

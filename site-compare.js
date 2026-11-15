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
  const controls = host.parentElement.querySelector('.site-compare__controls');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let manual = false, pending = false, visible = false;
  function setReveal(value) {
    const progress = Math.max(0, Math.min(100, value));
    host.style.setProperty('--reveal', `${progress}%`);
    slider.value = String(progress);
    slider.setAttribute('aria-valuetext', `${Math.round(progress)}% con proyecto`);
  }
  function onScroll() {
    if (pending || manual || reduced.matches || !visible) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const rect = host.getBoundingClientRect();
      setReveal((innerHeight * .8 - rect.top) / (innerHeight * .65) * 100);
    });
  }
  slider.addEventListener('input', () => { manual = true; setReveal(Number(slider.value)); });
  for (const button of controls.querySelectorAll('button')) {
    button.addEventListener('click', () => { manual = true; setReveal(Number(button.dataset.siteValue)); });
  }

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
      controls.hidden = false;
      if (reduced.matches) setReveal(50); else onScroll();
      addEventListener('scroll', onScroll, { passive: true });
      renderer.domElement.addEventListener('webglcontextlost', () => {
        host.classList.remove('is-ready');
        controls.hidden = true;
        layer.hidden = true;
      });
    } catch (error) {
      console.error('No se pudo cargar la implantación 3D.', error);
      controls.hidden = true;
      host.classList.remove('is-ready');
    }
  }
  let started = false;
  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && !started) { started = true; mount(); }
    if (visible) onScroll();
  });
  observer.observe(host);
}

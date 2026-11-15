import * as THREE from './vendor/three.module.js';
import { createHouse } from './house-model.js';
import { batchHouse } from './house-batches.js';
import { measureHouseFrame, fitHouseFrame } from './house-frame.js';

const host = document.querySelector('.house-stage');
const track = document.querySelector('.house-scroll');
const fallback = document.querySelector('.house-fallback');
try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setClearColor(0xffffff, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-15,15,15,-15,.1,150);
  const model = createHouse();
  batchHouse(model.parts);
  scene.add(model.root);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:.13}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.23;shadow.receiveShadow=true;scene.add(shadow);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa3a18c, 2.6));
  const sun = new THREE.DirectionalLight(0xfff6e5, 3.2);
  sun.position.set(-8,35,-15); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,far:70});
  sun.shadow.normalBias=.035; scene.add(sun);
  camera.position.set(27,36.6,30);
  camera.lookAt(-2,7.6,1);
  const frame=measureHouseFrame(model,camera,sun.position);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let dirty=true;
  function invalidate() { dirty=true; }
  function resize() {
    const bounds=host.getBoundingClientRect();
    const ratio=devicePixelRatio;
    // Align the drawing buffer and its CSS size to physical pixels.
    const width=Math.round(bounds.width*ratio)/ratio;
    const height=Math.round(bounds.height*ratio)/ratio;
    if(!width || !height)return;
    renderer.setPixelRatio(ratio);
    renderer.domElement.style.width=`${width}px`;
    renderer.domElement.style.height=`${height}px`;
    fitHouseFrame(camera,frame,width/height);
    renderer.setSize(width,height,false);invalidate();
  }
  renderer.domElement.setAttribute('aria-label','Vivienda con local: despiece tridimensional que avanza al bajar por la página.');
  renderer.domElement.setAttribute('role','img');
  host.append(renderer.domElement);fallback.hidden=true;
  document.querySelector('.cover__fig').classList.add('has-model');
  track.classList.add('is-live');
  new ResizeObserver(resize).observe(host);resize();
  addEventListener('scroll',invalidate,{passive:true});
  addEventListener('resize',invalidate,{passive:true});
  reduced.addEventListener('change',invalidate);
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();renderer.setAnimationLoop(null);host.hidden=true;fallback.hidden=false;track.classList.remove('is-live');
  });
  // An exploded drawing uses one fixed projection. Moving the camera with
  // progress resampled every stationary edge, even during a roofs-only stage.
  renderer.setAnimationLoop(()=>{
    if(!dirty || document.hidden)return;
    dirty=false;
    const bounds=track.getBoundingClientRect();
    const travel=Math.max(1,track.offsetHeight-innerHeight);
    const value=reduced.matches?1:THREE.MathUtils.clamp(-bounds.top/travel,0,1);
    model.setExplosion(value);
    renderer.render(scene,camera);
    host.dataset.progress=value.toFixed(3);
  });
  // Read-only diagnostics for local validation.
  host.dataset.model='ready';host.dataset.parts=String(model.parts.length);
} catch(error) {
  console.error('House model unavailable:',error);
  host.hidden=true;fallback.hidden=false;track.classList.remove('is-live');
}

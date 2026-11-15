// Ground registration, independent from the presentation and reveal control.
// Dimensions measured from the PDF's 1:50 plan, not a cadastral survey.
export const SITE = Object.freeze({
  width: 25, depth: 15, chamfer: 2,
  pixelsPerMetre: 16.6, // 10 m scale bar spans 166 px in the supplied 2000 px export.
  corner: [1198, 347], // Unchamfered street-corner intersection, visually registered.
  cameraHeight: 107, // Working estimate from the capture's eye altitude 130 m / ground 23 m.
});
// San Martín's measured road-center direction from the two adjacent OSM nodes.
// Latitude is converted to local east/north metres before calculating heading.
const angle = Math.atan2(.0001331, .0008012 * Math.cos(-32.4894 * Math.PI / 180));
const south = [Math.sin(angle), Math.cos(angle)];
const west = [-Math.cos(angle), Math.sin(angle)];

// Plan +X points towards San Martín; +Z towards Cazzulino.
// This gives the required quarter-turn compared with the former placement.
export function planToImage(x, z) {
  return SITE.corner.map((value, i) => value + SITE.pixelsPerMetre * (
    (SITE.width - x) * south[i] + (SITE.depth - z) * west[i]
  ));
}
export function parcelOutline() {
  return [[0,0],[25,0],[25,13],[23,15],[0,15]].map(([x,z]) => planToImage(x,z));
}
export function createSiteCamera(THREE) {
  const delta = [1000 - SITE.corner[0], 562.5 - SITE.corner[1]];
  const x = SITE.width - (delta[0]*south[0] + delta[1]*south[1]) / SITE.pixelsPerMetre;
  const z = SITE.depth - (delta[0]*west[0] + delta[1]*west[1]) / SITE.pixelsPerMetre;
  const fov = 2 * Math.atan(1125 / (2 * SITE.cameraHeight * SITE.pixelsPerMetre)) * 180 / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, 2000/1125, 1, 300);
  camera.position.set(x, SITE.cameraHeight, z);
  camera.up.set(Math.cos(angle), 0, Math.sin(angle));
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld(true);
  return camera;
}
export function registerHouseToPlan(THREE, model) {
  // Match the reconstructed footprints to the measured ground-floor drawing.
  // Heights are retained; the original exploded model is never modified.
  const house = new THREE.Matrix4().compose(
    new THREE.Vector3(12.7, 0, 5.5), new THREE.Quaternion(), new THREE.Vector3(1.23, 1, 1.19),
  );
  const shop = new THREE.Matrix4().compose(
    new THREE.Vector3(12.25, 0, 7.5-2*5.8/5.3), new THREE.Quaternion(), new THREE.Vector3(5.25/4.5, 1, 5.8/5.3),
  );
  const shopCorrection = house.clone().invert().multiply(shop);
  for (const part of model.parts) {
    if (part.name === 'Terreno y fundaciones') {
      for (const object of part.group.children) if (object.position.x < -5) object.applyMatrix4(shopCorrection);
    }
    part.group.applyMatrix4(part.name.toLowerCase().includes('local') ? shop : house);
  }
  model.root.updateMatrixWorld(true);
}

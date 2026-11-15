import { Box3, Vector3 } from './vendor/three.module.js';

// Measure both ends of every assembly's vertical travel once. Intermediate
// positions are contained by this union, so the projection never follows scroll.
export function measureHouseFrame(model, camera, sunPosition, groundY=-.23) {
  camera.updateMatrixWorld(true);
  const frame=new Box3();
  const worldBox=new Box3();
  function include(point, castsShadow) {
    frame.expandByPoint(point.clone().applyMatrix4(camera.matrixWorldInverse));
    if(castsShadow && point.y>groundY) {
      const distance=(point.y-groundY)/sunPosition.y;
      const shadow=point.clone().addScaledVector(sunPosition,-distance);
      shadow.y=groundY;
      frame.expandByPoint(shadow.applyMatrix4(camera.matrixWorldInverse));
    }
  }
  for(const progress of [0,1]) {
    model.setExplosion(progress);model.root.updateMatrixWorld(true);
    model.root.traverse(object=>{
      if(!object.geometry)return;
      object.geometry.computeBoundingBox();
      worldBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      for(const x of [worldBox.min.x,worldBox.max.x])for(const y of [worldBox.min.y,worldBox.max.y])for(const z of [worldBox.min.z,worldBox.max.z])include(new Vector3(x,y,z),object.castShadow);
    });
  }
  return frame;
}
export function fitHouseFrame(camera, frame, aspect) {
  const center=frame.getCenter(new Vector3());
  const size=frame.getSize(new Vector3());
  // Margin includes the soft edge of the shadow and prevents canvas clipping.
  const halfHeight=Math.max(size.y/2,size.x/(2*aspect))*1.1;
  const halfWidth=halfHeight*aspect;
  camera.left=center.x-halfWidth;camera.right=center.x+halfWidth;
  camera.bottom=center.y-halfHeight;camera.top=center.y+halfHeight;
  camera.updateProjectionMatrix();
}

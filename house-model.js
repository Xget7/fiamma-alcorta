import * as THREE from './vendor/three.module.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

// Reconstruction from the PDF plans, elevations and exploded axonometric.
// Units are approximate metres, not a survey or an export of the Revit model.
export function createHouse() {
  const root = new THREE.Group();
  const parts = [];
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .84, ...extra });
  const m = { wall: mat('#383a37'), inside: mat('#f0efe5'), concrete: mat('#b1b4a7'), floor: mat('#dbcaab'), wood: mat('#aa8253'), metal: mat('#30332f'), glass: mat('#b6d4d4', { transparent: true, opacity: .24, depthWrite: false }), teal: mat('#377b76'), cloth: mat('#e4dfcf'), upholstery: mat('#798580'), bedding: mat('#b5b6ab'), rug: mat('#4f5551'), brass: mat('#bbaa79', {metalness:.4,roughness:.45}) };
  const edge = new THREE.LineBasicMaterial({ color: '#353832', transparent: true, opacity: .22, depthWrite: false });
  function box(g, x, y, z, w, h, d, material, outline = false) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    if (outline) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge));
    return mesh;
  }
  function rounded(g,x,y,z,w,h,d,material,r=.06) {
    const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,Math.min(r,w/2,h/2,d/2)),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function rod(g,a,b,r,material) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),8),material);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());mesh.castShadow=true;g.add(mesh);return mesh;
  }
  function footing(g,x,z) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.22,.62,.42,4),m.concrete);
    mesh.rotation.y=Math.PI/4;mesh.position.set(x,.1,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
    box(g,x,.67,z,.23,.94,.23,m.concrete,true);
  }
  // Curved upholstered dining shells, distinct from the light metal bar stools.
  function chair(g,x,y,z,angle=0,stool=false) {
    const c=new THREE.Group();c.position.set(x,y,z);c.rotation.y=angle;g.add(c);
    const seat=stool?.72:.47;
    rounded(c,0,seat,0,.48,.09,.45,stool?m.teal:m.upholstery,.045);
    if(stool) {
      rounded(c,0,seat+.28,.2,.48,.075,.055,m.metal,.025);
      for(const xx of [-.22,.22])rod(c,[xx,seat-.04,.18],[xx,seat+.29,.2],.014,m.metal);
    } else {
      const vertices=[],indices=[],segments=24;
      // A continuous concave shell: curved shoulder and lower arm edges.
      for(let layer=0;layer<2;layer++)for(let row=0;row<2;row++)for(let i=0;i<=segments;i++) {
        const t=-1.42+2.84*i/segments;
        const radius=.275+layer*.035;
        vertices.push(Math.sin(t)*radius,seat+(row? .2+.23*Math.cos(t):-.005),.025+Math.cos(t)*radius);
      }
      const ring=segments+1;
      for(let layer=0;layer<2;layer++)for(let i=0;i<segments;i++) {
        const a=layer*ring*2+i,b=a+1,c=a+ring,d=c+1;
        if(layer===0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
      }
      for(let row=0;row<2;row++)for(let i=0;i<segments;i++) {
        const a=row*ring+i,b=a+1,c=a+ring*2,d=c+1;indices.push(a,b,c,b,d,c);
      }
      for(const i of [0,segments]){const a=i,b=i+ring,c=i+2*ring,d=i+3*ring;indices.push(a,c,b,b,c,d);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const shell=new THREE.Mesh(geo,m.upholstery);shell.castShadow=true;shell.receiveShadow=true;c.add(shell);
    }
    for(const a of [-1,1])for(const b of [-1,1])rod(c,[a*.17,seat-.03,b*.15],[a*.23,0,b*.23],.019,m.metal);
    if(stool)for(const side of [-1,1]) {
      rod(c,[-.2,.27,side*.2],[.2,.27,side*.2],.012,m.metal);
      rod(c,[side*.2,.27,-.2],[side*.2,.27,.2],.012,m.metal);
    }
    return c;
  }
  function table(g,x,y,z,w,d,height=.76,material=m.concrete) {
    rounded(g,x,y+height,z,w,.065,d,material,.03);
    for(const a of [-1,1])for(const b of [-1,1])rod(g,[x+a*(w/2-.12),y,z+b*(d/2-.1)],[x+a*(w/2-.18),y+height-.04,z+b*(d/2-.13)],.022,m.metal);
  }
  function fabric(g,x,y,z,w,d,material,amplitude=.025) {
    const geo=new THREE.PlaneGeometry(w,d,24,28);geo.rotateX(-Math.PI/2);
    const positions=geo.attributes.position;
    for(let i=0;i<positions.count;i++) {
      const xx=positions.getX(i),zz=positions.getZ(i);
      const drape=Math.max(0,(Math.abs(xx)/(w/2)-.85)/.15);
      positions.setY(i,amplitude*(Math.sin(xx*19+zz*3)+.4*Math.sin(zz*31))-drape*.1);
    }
    geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function part(name, stage, offset) {
    const g = new THREE.Group(); g.name = name; root.add(g);
    parts.push({ group: g, name, stage, offset: new THREE.Vector3(...offset) }); return g;
  }
  // Wall in local XY; openings are actual voids with glass and aluminium frames.
  function wall(g, x, y, z, length, angle, openings = [], height = 2.8) {
    const frame = new THREE.Group(); frame.position.set(x,y,z); frame.rotation.y = angle; g.add(frame);
    const xs = [...new Set([0,length,...openings.flatMap(o=>[o[0],o[0]+o[2]])])].sort((a,b)=>a-b);
    for (let i=0;i<xs.length-1;i++) {
      const a=xs[i], b=xs[i+1], opening= openings.find(o=>a>=o[0] && b<=o[0]+o[2]);
      const bands = opening ? [[0,opening[1]],[opening[1]+opening[3],height]] : [[0,height]];
      for (const [lo,hi] of bands) if(hi>lo) {
        box(frame,(a+b)/2,(lo+hi)/2,0,b-a,hi-lo,.2,m.wall,true);
        box(frame,(a+b)/2,(lo+hi)/2,-.105,b-a,hi-lo,.015,m.inside);
      }
    }
    box(frame,length/2,height+.013,0,length,.025,.22,m.inside);
    for (const [a,b,w,h] of openings) {
      if(h>=.75)box(frame,a+w/2,b+h/2,0,w-.065,h-.065,.018,m.glass);
      box(frame,a+w/2,b-.025,.035,w+.08,.05,.28,m.inside);
      if(h<.75) {
        const sash=box(frame,a+w/2,b+h/2,.035,w-.1,h-.08,.025,m.glass);
        sash.rotation.x=-.14;
      }
      for (const xx of [a,a+w]) box(frame,xx,b+h/2,0,.045,h,.12,m.metal);
      for (const yy of [b,b+h]) box(frame,a+w/2,yy,0,w,.045,.12,m.metal);
      const n=Math.max(1,w>=3.9?4:Math.round(w/.85));
      for(let i=1;i<n;i++) box(frame,a+i*w/n,b+h/2,0,.035,h,.09,m.metal);
    }
  }
  // Close the tapered roof/wall junctions; the previous flat wall tops left
  // visible daylight gaps at the high end and intersected the low roof edge.
  function roofHead(g,x,y,z,length,angle,startHeight,endHeight) {
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(length,0);shape.lineTo(length,endHeight);shape.lineTo(0,startHeight);shape.closePath();
    const frame=new THREE.Group();frame.position.set(x,y,z);frame.rotation.y=angle;g.add(frame);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false});geometry.translate(0,0,-.1);
    const mesh=new THREE.Mesh(geometry,m.wall);mesh.castShadow=true;mesh.receiveShadow=true;frame.add(mesh);
    const liningGeometry=geometry.clone();liningGeometry.scale(1,1,.075);liningGeometry.translate(0,0,-.106);
    frame.add(new THREE.Mesh(liningGeometry,m.inside));
    const cap=box(frame,length/2,(startHeight+endHeight)/2,0,Math.hypot(length,endHeight-startHeight),.025,.22,m.inside);
    cap.rotation.z=Math.atan2(endHeight-startHeight,length);
  }
  function rail(g,x,y,z,length,angle=0) {
    const r=new THREE.Group(); r.position.set(x,y,z); r.rotation.y=angle; g.add(r);
    for(let i=0;i<=Math.ceil(length);i++) box(r,i*length/Math.ceil(length),.5,0,.035,1,.035,m.metal);
    for(let i=1;i<5;i++) box(r,length/2,i*.2,0,length,.02,.02,m.metal);
    box(r,length/2,1,0,length,.045,.055,m.wood);
  }
  function roof(g,x,y,z,w,d) {
    const r=new THREE.Group(); r.position.set(x,y,z); r.rotation.x=-.055; g.add(r);
    box(r,0,0,0,w,.15,d,m.wood,true); box(r,0,.09,0,w,.035,d,m.metal);
    for(let i=-w/2+.3;i<w/2;i+=.65)box(r,i,-.14,0,.07,.17,d,m.wood);
    for(let i=-w/2;i<=w/2;i+=.35) box(r,i,.125,0,.018,.035,d,m.metal);
  }
  const site=part('Terreno y fundaciones',0,[0,0,0]);
  box(site,1.5,-.16,5.3,12.2,.13,1.65,m.concrete,true);
  box(site,-2,-.16,2.55,2.4,.13,4.3,m.concrete,true);
  // Main house footprint is L-shaped; shop remains a detached volume.
  for(const [x,z] of [[0,0],[8,0],[0,4.2],[2.4,8.4],[5.5,8.4],[8,8.4],[9.7,8.4],[9.7,4.2],[-7.5,6.5],[-3,6.5],[-7.5,11.8],[-3,11.8]]) {
    footing(site,x-3,z-4.5);
  }
  const ground=part('Planta baja · estar, comedor y cocina',5,[0,0,0]);
  box(ground,1,1.12,-2.4,8,.22,4.2,m.floor,true);
  box(ground,2.2,1.12,1.8,5.6,.22,4.2,m.floor,true);
  box(ground,5.85,1.12,1.8,1.7,.22,4.2,m.floor,true);
  wall(ground,5,1.23,-4.5,8,Math.PI);
  wall(ground,-3,1.23,-4.5,4.2,-Math.PI/2,[[1.35,.9,2,1]]);
  wall(ground,-3,1.23,-.3,2.4,0,[[.4,0,1.6,2.2]]);
  wall(ground,-.6,1.23,-.3,4.2,-Math.PI/2);
  wall(ground,-.6,1.23,3.9,7.3,0,[[2.4,.9,3,1]]);
  wall(ground,5,1.23,-.3,4.2,Math.PI/2,[[.35,0,.9,2.2],[1.7,.7,2,1.5]]);
  wall(ground,6.7,1.23,3.9,4.2,Math.PI/2,[[.25,1.8,1.5,.5],[2.35,1.8,1.5,.5]]);
  wall(ground,5,1.23,-.3,1.7,0);
  box(ground,5.8,2.6,1.9,1.7,2.75,.12,m.inside);
  wall(ground,5,1.23,-.3,4.2,-Math.PI/2,[[.4,0,.8,2.1],[2.5,0,.8,2.1]]);
  // Ground-floor frame, white structural posts and dark perimeter beam.
  for(const [x,z] of [[-.35,-.2],[2.55,-.2]]) box(ground,x,2.65,z,.16,2.85,.16,m.inside);
  box(ground,3.05,1.08,3.93,7.5,.28,.18,m.wall);
  box(ground,6.73,1.08,1.8,.18,.28,4.4,m.wall);
  // Kitchen: cabinet fronts, worktop, double sink, oven, hood and fridge.
  box(ground,-2.48,1.7,-2.4,.7,.94,3.4,m.metal);
  box(ground,-2.48,2.2,-2.4,.78,.07,3.5,m.inside);
  for(let z=-3.9;z<-.9;z+=.5){box(ground,-2.115,1.7,z,.025,.82,.47,m.wall);rod(ground,[-2.09,2.04,z-.12],[-2.09,2.04,z+.12],.01,m.concrete);}
  box(ground,-2.48,2.24,-.65,.78,2,.67,m.concrete);
  box(ground,-2.075,2.24,-.65,.025,1.91,.6,m.inside);
  box(ground,-2.054,2.24,-.65,.012,1.91,.012,m.metal);
  for(const z of [-.81,-.49])rod(ground,[-2.043,1.83,z],[-2.043,2.17,z],.014,m.metal);
  box(ground,-2.042,2.02,-.81,.01,.2,.1,m.metal);
  // Tile joints stop behind the counter and continue around the sink/hood.
  for(let y=2.32;y<3.8;y+=.18)box(ground,-2.878,y,-2.4,.008,.006,3.8,m.concrete);
  for(let z=-4.22;z<-.55;z+=.34)box(ground,-2.875,3.03,z,.01,1.45,.006,m.concrete);
  for(const z of [-2.36,-1.92]) {
    rounded(ground,-2.46,2.25,z,.49,.025,.36,m.metal,.07);
    rounded(ground,-2.46,2.27,z,.39,.025,.27,m.concrete,.05);
  }
  rod(ground,[-2.7,2.25,-2.13],[-2.7,2.55,-2.13],.018,m.metal);
  rod(ground,[-2.7,2.55,-2.13],[-2.42,2.55,-2.13],.018,m.metal);
  box(ground,-2.46,2.25,-3.12,.62,.035,.65,m.metal);
  for(const x of [-2.65,-2.3])for(const z of [-3.3,-2.96]) {
    const burner=new THREE.Mesh(new THREE.TorusGeometry(.095,.012,5,16),m.concrete);burner.rotation.x=Math.PI/2;burner.position.set(x,2.28,z);ground.add(burner);
  }
  box(ground,-2.1,1.7,-3.12,.035,.52,.59,m.metal);
  box(ground,-2.07,1.72,-3.12,.02,.31,.45,m.glass);
  for(let i=0;i<4;i++)rod(ground,[-2.04,1.91,-3.33+i*.14],[-2.015,1.91,-3.33+i*.14],.022,m.concrete);
  rod(ground,[-2.69,2.4,-2.13],[-2.58,2.43,-2.13],.012,m.metal);
  rod(ground,[-2.04,1.99,-3.36],[-2.04,1.99,-2.88],.015,m.concrete);
  box(ground,-2.48,2.94,-3.12,.9,.09,.85,m.concrete);
  box(ground,-2.72,3.4,-3.12,.26,.87,.28,m.metal);
  box(ground,-.65,1.7,-2.6,.72,.94,2.9,m.metal);
  box(ground,-.65,2.2,-2.6,.86,.065,3.1,m.inside);
  for(let i=0;i<3;i++)chair(ground,.1,1.24,-3.5+i*.9,Math.PI/2,true);
  table(ground,2.8,1.24,-2.5,2.4,1.05);
  for(let i=0;i<3;i++)for(const side of [-1,1])chair(ground,1.95+i*.85,1.24,-2.5+side*.88,side===1?0:Math.PI);
  chair(ground,1.28,1.24,-2.5,-Math.PI/2);chair(ground,4.32,1.24,-2.5,Math.PI/2);
  for(const x of [2.5,2.8,2.95])rod(ground,[x,2.05,-2.5],[x,2.3,-2.5],.035,m.metal);
  // Sofa follows the plan: length north-south, facing the stair/TV wall.
  const sofa=new THREE.Group();sofa.position.set(2.15,1.24,1.5);sofa.rotation.y=Math.PI/2;ground.add(sofa);
  // The reference sofa sits in a black tubular cradle with exposed feet.
  rounded(sofa,0,.3,0,2.48,.28,.88,m.teal,.08);
  rounded(sofa,0,.66,.34,2.42,.52,.2,m.teal,.08);
  for(const x of [-1.15,1.15])rounded(sofa,x,.55,-.01,.2,.4,.87,m.teal,.06);
  for(const x of [-.75,0,.75])rounded(sofa,x,.49,-.055,.7,.16,.64,m.teal,.06);
  for(const x of [-1.23,1.23]) {
    rod(sofa,[x,.08,-.45],[x,.08,.45],.018,m.metal);
    rod(sofa,[x,.08,-.45],[x,.59,-.45],.018,m.metal);
    rod(sofa,[x,.08,.45],[x,.77,.45],.018,m.metal);
    rod(sofa,[x,.59,-.45],[x,.77,.45],.018,m.metal);
  }
  for(const z of [-.45,.45])rod(sofa,[-1.23,.08,z],[1.23,.08,z],.018,m.metal);
  rod(sofa,[-1.23,.77,.45],[1.23,.77,.45],.018,m.metal);
  for(const x of [-.8,.8]){const pillow=rounded(sofa,x,.76,.15,.45,.39,.15,m.upholstery,.065);pillow.rotation.z=x*.19;pillow.rotation.x=-.18;}
  const throwMat=mat('#9a9742',{side:THREE.DoubleSide});
  const blanket=fabric(sofa,.3,.61,.03,.58,.86,throwMat,.018);blanket.rotation.y=.12;
  table(ground,.95,1.24,1.5,.58,1.1,.4,m.floor);
  const book=box(ground,.95,1.69,1.3,.22,.035,.3,m.metal);book.rotation.y=.2;
  // Bathroom and laundry fixtures, visible in the exploded view.
  for(const z of [.45,2.75]) {
    box(ground,6.2,1.62,z,.65,.75,.6,m.inside);
    rounded(ground,6.2,2.02,z,.55,.07,.5,m.concrete,.08);
    rounded(ground,6.2,2.06,z,.38,.04,.32,m.inside,.1);
  }
  rounded(ground,5.6,1.55,.2,.4,.5,.6,m.inside,.12);
  box(ground,6.15,1.28,1.2,.85,.09,.8,m.inside);
  box(ground,5.62,1.7,3.25,.65,.9,.65,m.inside);
  const washer=new THREE.Mesh(new THREE.TorusGeometry(.19,.025,8,24),m.metal);washer.position.set(5.62,1.72,3.59);ground.add(washer);
  const stairs=part('Escaleras y accesos',4,[0,0,0]);
  // Six lower risers, a quarter-turn landing, then ten upper risers.
  // Their finished levels join the PB/PA floors without an extra floating step.
  const stairRise=(4.26-1.23)/16;
  const landingY=1.23+6*stairRise;
  for(let i=0;i<6;i++)box(stairs,1.85-i*.25,1.23+(i+1)*stairRise-.065,3.25,.27,.13,.95,m.inside,true);
  box(stairs,.1,landingY-.065,3.0,1.05,.13,1.05,m.inside,true);
  for(let i=0;i<10;i++)box(stairs,.1,landingY+(i+1)*stairRise-.065,2.5-i*.25,1.05,.13,.27,m.inside,true);
  function stairSupport(run,rise,depth) {
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(run,rise);shape.lineTo(run,rise-.23);shape.lineTo(0,-.23);shape.closePath();
    return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),m.wall);
  }
  const upperStringer=stairSupport(2.5,10*stairRise,1.05);
  upperStringer.rotation.y=Math.PI/2;upperStringer.position.set(-.425,landingY-.065,2.62);upperStringer.castShadow=true;stairs.add(upperStringer);
  const lowerStringer=stairSupport(1.5,6*stairRise,.95);
  lowerStringer.rotation.y=Math.PI;lowerStringer.position.set(1.975,1.23-.065,3.725);lowerStringer.castShadow=true;stairs.add(lowerStringer);
  box(ground,-.05,1.8,.5,.85,.07,1.7,m.concrete);
  box(ground,-.05,1.31,.5,.85,.07,1.7,m.concrete);
  for(const z of [-.3,.22,.78,1.3])box(ground,-.05,1.55,z,.85,.45,.045,m.concrete);
  box(ground,-.46,1.55,.5,.035,.45,1.7,m.wall);
  box(ground,.1,1.85,.45,.3,.045,.42,m.metal);
  box(ground,.1,2.03,.45,.055,.65,1.05,m.metal);
  // Floating entry treads; shop entry is on its east side, facing the house.
  for(let i=0;i<7;i++)box(site,5.27+i*.42,1.12-i*.15,-1.05,.38,.14,1.25,m.inside,true);
  for(let i=0;i<5;i++)box(site,-5.7+i*.52,1.12-i*.21,3,.48,.15,1.25,m.inside,true);
  // Pergola columns are anchored to the courtyard, not railings on the shop path.
  for(const z of [-.2,3.85])box(ground,-2.94,2.65,z,.085,2.9,.085,m.wood);
  const upper=part('Planta alta · habitación y servicios',2,[0,7,0]);
  // Leave the stairwell open through the mezzanine slab.
  box(upper,2.85,4.15,1.8,4.3,.22,4.2,m.floor,true);
  box(upper,.05,4.15,0,1.3,.22,.6,m.floor,true);
  box(upper,.05,4.15,3.6,1.3,.22,.6,m.floor,true);
  box(upper,5.85,4.15,1.8,1.7,.22,4.2,m.floor,true);
  wall(upper,-.6,4.26,3.9,7.3,0,[[3.8,0,1.4,2.25]]);
  wall(upper,-.6,4.26,-4.5,4.2,-Math.PI/2,[[.6,.45,2.7,.95]],1.8);
  wall(upper,-.6,4.26,-.3,4.2,-Math.PI/2,[[.65,.8,.6,1.5],[1.65,.8,.6,1.5],[2.65,.8,.6,1.5]]);
  wall(upper,5,4.26,-4.5,5.6,Math.PI,[[.7,.45,3.8,.95]],1.8);
  wall(upper,5,4.26,-.3,4.2,Math.PI/2,[[.6,.45,2.4,.95]],1.8);
  wall(upper,6.7,5.6,-.3,7.3,Math.PI,[[.3,.12,3,1],[3.9,.12,3,1]],1.46);
  wall(upper,6.7,4.26,3.9,4.2,Math.PI/2,[[2.35,1.8,1.5,.5]]);
  wall(upper,5,4.26,-.3,1.7,0);
  box(upper,5.8,5.6,1.9,1.7,2.65,.12,m.inside);
  wall(upper,5,4.26,-.3,2.2,-Math.PI/2,[[.5,0,.8,2.1]]);
  rail(upper,.55,4.27,-.3,4.4);
  for(const x of [-.35,2.55])box(upper,x,5.6,-.2,.16,2.8,.16,m.inside);
  box(upper,2.2,4.2,-.3,5.6,.23,.18,m.concrete);
  // Bedroom from the interior plate: upholstered bed, charcoal rug, wardrobe,
  // reading chair, shelves and a desk facing the double-height space.
  box(upper,2.65,4.278,2.05,3.7,.025,3.4,m.rug);
  rounded(upper,2.5,4.48,2.5,1.82,.32,2.2,m.bedding,.09);
  rounded(upper,2.5,4.72,2.5,1.8,.2,2.15,m.cloth,.085);
  rounded(upper,2.5,4.98,3.56,1.88,.62,.13,m.bedding,.07);
  const duvetMaterial=mat('#afb0a6',{side:THREE.DoubleSide});
  fabric(upper,2.5,4.87,2.3,1.94,1.78,duvetMaterial,.04);
  for(const x of [2.05,2.95])rounded(upper,x,4.93,3.2,.73,.16,.46,m.cloth,.07);
  for(const x of [1.72,3.28])for(const z of [1.58,3.42])rod(upper,[x,4.27,z],[x,4.42,z],.025,m.brass);
  box(upper,1.18,5.3,3.48,1.0,2.05,.58,m.wall);
  for(const x of [.94,1.42]) {
    box(upper,x,5.3,3.785,.465,1.98,.025,m.metal);
    rod(upper,[x+.12,5.12,3.81],[x+.12,5.49,3.81],.012,m.concrete);
  }
  const lounge=chair(upper,1.5,4.28,.72,Math.PI/4);lounge.scale.set(1.35,1.12,1.35);
  table(upper,3.88,4.28,.48,1.4,.62,.74,m.inside);
  const office=new THREE.Group();office.position.set(3.88,4.28,1.1);upper.add(office);
  rounded(office,0,.47,0,.47,.08,.45,m.inside,.035);
  box(office,0,.76,.2,.46,.55,.055,m.inside);
  for(let x=-.18;x<=.18;x+=.045)box(office,x,.76,.233,.008,.45,.008,m.concrete);
  rod(office,[0,.08,0],[0,.45,0],.035,m.concrete);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5,x=Math.cos(a)*.29,z=Math.sin(a)*.29;
    rod(office,[0,.12,0],[x,.07,z],.016,m.concrete);
    const caster=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),m.metal);caster.position.set(x,.045,z);office.add(caster);
  }
  for(const x of [-.28,.28]){rod(office,[x,.45,.15],[x,.67,.15],.013,m.concrete);rounded(office,x,.67,.015,.055,.04,.27,m.inside,.02);}
  rounded(upper,2.5,4.63,1.15,1.55,.22,.42,m.bedding,.065);
  for(const x of [1.85,3.15])for(const z of [1.01,1.29])rod(upper,[x,4.28,z],[x,4.54,z],.021,m.brass);
  for(const x of [1.2,3.4]) {
    box(upper,x,5.55,3.76,.86,.67,.12,m.wood);
    for(let row=0;row<3;row++) {
      box(upper,x,5.28+row*.23,3.67,.82,.025,.22,m.floor);
      for(let i=0;i<5;i++)box(upper,x-.32+i*.12,5.38+row*.23,3.64,.07,.17,.13,i%2?m.teal:m.cloth);
    }
  }
  // Bath tub, basin and toilet in the upper service compartment.
  rounded(upper,5.83,4.55,.35,.86,.48,1.2,m.inside,.13);
  rounded(upper,5.83,4.8,.35,.66,.04,.98,m.concrete,.15);
  rounded(upper,5.83,4.83,.35,.52,.025,.84,m.inside,.13);
  rounded(upper,6.25,4.7,1.38,.43,.6,.62,m.inside,.11);
  box(upper,5.45,4.65,1.45,.5,.75,.48,m.wood);
  rounded(upper,5.45,5.05,1.45,.47,.09,.42,m.inside,.12);
  rod(upper,[5.45,5.08,1.62],[5.45,5.3,1.62],.014,m.metal);
  // Wardrobe/dressing area on the other side of the service partition.
  box(upper,5.83,5.3,3.53,1.46,2.05,.5,m.wall);
  for(const x of [5.48,6.18]) {
    box(upper,x,5.3,3.26,.67,1.98,.025,m.inside);
    rod(upper,[x+.19,5.12,3.24],[x+.19,5.48,3.24],.013,m.metal);
  }
  const balcony=part('Balcón y pérgola',2,[0,7,0]);
  const kitchenRoof=part('Cubierta de cocina',1,[0,3.2,0]);
  box(kitchenRoof,-1.8,4.13,-2.4,2.4,.2,4.2,m.concrete,true);
  box(balcony,2.2,4.13,4.55,5.6,.2,1.3,m.wall,true);
  rail(balcony,-.6,4.25,5.2,5.6); rail(balcony,-.6,4.25,3.9,1.3,-Math.PI/2);rail(balcony,5,4.25,5.2,1.3,Math.PI/2);
  for(let i=0;i<25;i++)box(balcony,-1.8,4.1,-.2+i*.17,2.4,.1,.07,m.wood);
  for(const x of [-2.94,-.66])box(balcony,x,4.02,1.84,.09,.16,4.22,m.wood);
  const shop=part('Local de ropa',5,[0,0,0]);
  box(shop,-8.25,1.12,4.65,4.5,.22,5.3,m.floor,true);
  wall(shop,-10.5,1.23,7.3,4.5,0,[[.25,.05,4,2.45]]);
  wall(shop,-10.5,1.23,2,5.3,-Math.PI/2);
  wall(shop,-6,1.23,2,4.5,Math.PI);
  wall(shop,-6,1.23,7.3,5.3,Math.PI/2,[[3.6,0,.85,2.2]]);
  box(shop,-8.25,1.08,7.33,4.7,.27,.18,m.wall);
  box(shop,-5.97,1.08,4.65,.18,.27,5.4,m.wall);
  table(shop,-8.2,1.24,5.5,1.45,.8,.68,m.inside);
  table(shop,-8.48,1.24,6.08,1.1,.65,.35,m.floor);
  box(shop,-8.48,1.3,6.08,1.1,.06,.65,m.floor);
  rounded(shop,-7.5,1.58,4.9,.85,.65,.7,m.cloth);
  for(let i=0;i<3;i++)box(shop,-7.5,1.94,4.7+i*.2,.84,.015,.015,m.wood);
  box(shop,-6.65,1.8,3.8,.7,1.1,1.4,m.floor);
  function garment(g,x,y,z,color,variant=0,angle=0) {
    const outfit=new THREE.Group();outfit.position.set(x,y,z);outfit.rotation.y=angle;g.add(outfit);
    const shape=new THREE.Shape();shape.moveTo(-.1,0);shape.lineTo(-.29,-.1);shape.lineTo(-.22,-.29);shape.lineTo(-.15,-.24);
    const length=variant%3===0?.9:.67;
    shape.lineTo(-.18,length*-1);shape.lineTo(.18,-length);shape.lineTo(.15,-.24);shape.lineTo(.22,-.29);shape.lineTo(.29,-.1);shape.lineTo(.1,0);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:1,steps:1});
    const mesh=new THREE.Mesh(geometry,color);mesh.castShadow=true;mesh.receiveShadow=true;outfit.add(mesh);
    for(const a of [-1,1])rod(outfit,[0,.1,0],[a*.2,-.01,0],.008,m.wood);
    rod(outfit,[-.2,-.01,0],[.2,-.01,0],.008,m.wood);
    const hook=new THREE.Mesh(new THREE.TorusGeometry(.035,.007,5,12,Math.PI*1.5),m.metal);hook.position.set(0,.13,0);outfit.add(hook);
    // Raised seams give the cloth volume without overlapping broad faces.
    for(const side of [-1,1])rod(outfit,[side*.12,-.25,.032],[side*.14,-length+.04,.032],.004,color);
  }
  for(const z of [3.35,5.15]) {
    rounded(shop,-9.8,1.59,z,.65,.095,1.25,m.floor,.045);
    for(const dx of [-.22,.22])for(const dz of [-.45,.45])rod(shop,[-9.8+dx,1.24,z+dz],[-9.8+dx,1.54,z+dz],.016,m.metal);
    for(const dz of [-.55,.55])rod(shop,[-9.8,1.45,z+dz],[-9.8,3,z+dz],.024,m.metal);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-9.8,3,z-.55),new THREE.Vector3(-9.8,3.27,z),new THREE.Vector3(-9.8,3,z+.55)]);
    shop.add(new THREE.Mesh(new THREE.TubeGeometry(curve,16,.024,6,false),m.metal));
    rod(shop,[-9.8,2.98,z-.55],[-9.8,2.98,z+.55],.018,m.wood);
    for(let i=0;i<6;i++)garment(shop,-9.8,2.87,z-.4+i*.16,i%3===0?m.teal:i%3===1?m.cloth:m.wall,i);
  }
  for(const x of [-8.7,-7.3]) {
    rod(shop,[x-.55,2.9,2.35],[x+.55,2.9,2.35],.024,m.wood);
    for(const dx of [-.55,.55])rod(shop,[x+dx,1.25,2.35],[x+dx,2.9,2.35],.018,m.metal);
    for(let i=0;i<7;i++) {
      garment(shop,x-.45+i*.15,2.78,2.35,i%2?m.cloth:m.wall,i,Math.PI/2);
    }
  }
  rounded(shop,-9.5,2.25,2.35,.5,1.8,.09,m.metal,.18);
  rounded(shop,-9.5,2.25,2.405,.43,1.69,.015,m.glass,.13);
  for(const x of [-9.68,-9.32])rod(shop,[x,1.25,2.5],[x,1.7,2.36],.015,m.metal);
  const roofShop=part('Cubierta del local',1,[0,5.6,0]); roof(roofShop,-8.25,4.3,4.65,4.9,5.7);
  const shopLow=4.3-.075+Math.sin(.055)*(2-4.65)-4.03;
  const shopHigh=4.3-.075+Math.sin(.055)*(7.3-4.65)-4.03;
  roofHead(shop,-10.5,4.03,2,5.3,-Math.PI/2,shopLow,shopHigh);
  roofHead(shop,-6,4.03,7.3,5.3,Math.PI/2,shopHigh,shopLow);
  roofHead(shop,-10.5,4.03,7.3,4.5,0,shopHigh,shopHigh);
  roofHead(shop,-6,4.03,2,4.5,Math.PI,shopLow,shopLow);
  const roofMain=part('Cubierta alta de chapa',1,[0,11.3,0]);roof(roofMain,3.05,7.35,1.8,7.9,4.8);
  const highBack=7.35-.075+Math.sin(.055)*(-.3-1.8)-7.06;
  const highFront=7.35-.075+Math.sin(.055)*(3.9-1.8)-7.06;
  roofHead(upper,-.6,7.06,-.3,4.2,-Math.PI/2,highBack,highFront);
  roofHead(upper,6.7,7.06,3.9,4.2,Math.PI/2,highFront,highBack);
  roofHead(upper,-.6,7.06,3.9,7.3,0,highFront,highFront);
  roofHead(upper,6.7,7.06,-.3,7.3,Math.PI,highBack,highBack);
  const roofService=part('Cubierta baja sobre doble altura',1,[0,11.3,0]);
  box(roofService,2.2,6.16,-2.4,6.1,.14,4.5,m.wood,true);
  box(roofService,2.2,6.245,-2.4,6.1,.035,4.5,m.concrete);
  const timberLine=new THREE.LineBasicMaterial({color:'#9a805d',transparent:true,opacity:.19});
  function boards(group,x,z,w,d,y) {
    const points=[];
    for(let zz=z-d/2;zz<=z+d/2;zz+=.16) {
      points.push(x-w/2,y,zz,x+w/2,y,zz);
      const row=Math.round((zz-z+d/2)/.16);
      for(let xx=x-w/2+.8+(row%3)*.4;xx<x+w/2;xx+=1.6)points.push(xx,y,zz,xx,y,Math.min(zz+.16,z+d/2));
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));group.add(new THREE.LineSegments(geo,timberLine));
  }
  boards(ground,1,-2.4,7.8,4,1.235);boards(ground,2.2,1.8,5.4,4,1.235);
  boards(shop,-8.25,4.65,4.3,5.1,1.235);boards(upper,2.85,1.8,4.1,4,4.265);
  // Fine projection lines keep the parts legible when separated.
  const guides=new THREE.Group(); root.add(guides);
  const guideMaterial=new THREE.LineDashedMaterial({color:'#7e8984',dashSize:.12,gapSize:.15,transparent:true,opacity:.42});
  for(const [x,z] of [[-.6,-4.5],[5,-4.5],[-.6,3.9],[6.7,3.9],[-10.5,2],[-6,7.3]]) {
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,1.1,z),new THREE.Vector3(x,x < -5 ? 9.7 : 18.5,z)]),guideMaterial);line.computeLineDistances();guides.add(line);
  }
  function setExplosion(value) {
    for(const p of parts) {
      const t=THREE.MathUtils.smoothstep(value*3-(Math.min(p.stage,3)-1),0,1);
      p.group.position.copy(p.offset).multiplyScalar(p.stage===0?0:t);
    }
    guides.visible=value>.05; guideMaterial.opacity=.42*value;
  }
  setExplosion(1);
  return {root,parts,setExplosion};
}

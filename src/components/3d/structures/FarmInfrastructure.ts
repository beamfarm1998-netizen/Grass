import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// PROCEDURAL INFRASTRUCTURE BUILDERS (Zero-dependency fallbacks)
// ─────────────────────────────────────────────────────────────

export function buildWaterTowerProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'WaterTower';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
  const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.35 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb5532e, roughness: 0.6 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.95 });
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.5, roughness: 0.4 });
  const waterGaugeMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, emissive: 0x01579b, emissiveIntensity: 0.3 });

  const legRadius = 1.6;
  const legH = 4.2;
  const legAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

  legAngles.forEach((ang) => {
    const x = Math.cos(ang) * legRadius;
    const z = Math.sin(ang) * legRadius;

    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.5, 8), concreteMat);
    pier.position.set(x, 0.25, z);
    pier.castShadow = true;
    pier.receiveShadow = true;
    root.add(pier);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, legH, 0.24), woodDarkMat);
    leg.position.set(x * 0.9, 0.5 + legH / 2, z * 0.9);
    leg.rotation.y = -ang;
    leg.rotation.z = 0.05 * (x > 0 ? -1 : 1);
    leg.castShadow = true;
    root.add(leg);
  });

  [1.8, 3.2, 4.5].forEach((yLevel) => {
    for (let i = 0; i < 4; i++) {
      const a1 = legAngles[i];
      const a2 = legAngles[(i + 1) % 4];
      const x1 = Math.cos(a1) * legRadius * 0.9;
      const z1 = Math.sin(a1) * legRadius * 0.9;
      const x2 = Math.cos(a2) * legRadius * 0.9;
      const z2 = Math.sin(a2) * legRadius * 0.9;

      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.12), woodDarkMat);
      beam.position.set((x1 + x2) / 2, yLevel, (z1 + z2) / 2);
      beam.rotation.y = -Math.atan2(dz, dx);
      beam.castShadow = true;
      root.add(beam);
    }
  });

  const deckY = 4.7;
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.2, 16), woodDarkMat);
  platform.position.y = deckY;
  platform.castShadow = true;
  root.add(platform);

  const railingH = 0.8;
  const railRadius = 2.0;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, railingH, 6), metalMat);
    post.position.set(Math.cos(ang) * railRadius, deckY + railingH / 2, Math.sin(ang) * railRadius);
    root.add(post);
  }
  const topRail = new THREE.Mesh(new THREE.TorusGeometry(railRadius, 0.04, 6, 24), metalMat);
  topRail.position.y = deckY + railingH;
  topRail.rotation.x = Math.PI / 2;
  root.add(topRail);

  const tankRadius = 1.7;
  const tankH = 2.4;
  const tankY = deckY + 0.1 + tankH / 2;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankRadius, tankRadius * 1.05, tankH, 20), woodMat);
  tank.position.y = tankY;
  tank.castShadow = true;
  root.add(tank);

  [-0.9, -0.3, 0.3, 0.9].forEach((yOffset) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(tankRadius * 1.03, 0.04, 6, 24), metalMat);
    hoop.position.y = tankY + yOffset;
    hoop.rotation.x = Math.PI / 2;
    root.add(hoop);
  });

  const roofH = 1.4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(tankRadius * 1.25, roofH, 20), roofMat);
  roof.position.y = tankY + tankH / 2 + roofH / 2;
  roof.castShadow = true;
  root.add(roof);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), metalMat);
  finial.position.y = tankY + tankH / 2 + roofH + 0.15;
  root.add(finial);

  const ladderZ = legRadius * 0.9 + 0.15;
  const ladderH = deckY + railingH;
  [-0.2, 0.2].forEach((lx) => {
    const lRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ladderH, 6), ladderMat);
    lRail.position.set(lx, ladderH / 2, ladderZ);
    root.add(lRail);
  });
  for (let i = 1; i <= 14; i++) {
    const ry = (i / 15) * ladderH;
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), ladderMat);
    rung.position.set(0, ry, ladderZ);
    rung.rotation.z = Math.PI / 2;
    root.add(rung);
  }

  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, deckY, 8), metalMat);
  pipe.position.set(0, deckY / 2, 0);
  pipe.castShadow = true;
  root.add(pipe);

  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), metalMat);
  valve.position.set(0, 0.8, 0.3);
  valve.rotation.x = Math.PI / 2;
  root.add(valve);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), waterGaugeMat);
  handle.position.set(0, 0.8, 0.6);
  root.add(handle);

  return root;
}

export function buildWindmillProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Windmill';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 0.95 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.8 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
  const sailFrameMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9, side: THREE.DoubleSide });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7, roughness: 0.3 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.85 });

  const baseH = 2.0;
  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, baseH, 8), stoneMat);
  baseMesh.position.y = baseH / 2;
  baseMesh.castShadow = true;
  root.add(baseMesh);

  const baseTrim = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.85, 0.3, 8), timberMat);
  baseTrim.position.y = 0.15;
  root.add(baseTrim);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.45, 0.15), doorMat);
  door.position.set(0, 0.8, 2.48);
  root.add(door);

  const midH = 4.2;
  const midMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.25, midH, 8), woodPlankMat);
  midMesh.position.y = baseH + midH / 2;
  midMesh.castShadow = true;
  root.add(midMesh);

  const galleryY = baseH + midH * 0.7;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.18, 16), timberMat);
  gallery.position.y = galleryY;
  root.add(gallery);

  const capY = baseH + midH;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 16), roofMat);
  cap.position.y = capY + 0.8;
  cap.castShadow = true;
  root.add(cap);

  const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), timberMat);
  tailBoom.position.set(0, capY + 0.6, -1.8);
  root.add(tailBoom);
  const rudderVane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.9), clothMat);
  rudderVane.position.set(0, capY + 0.7, -2.8);
  root.add(rudderVane);

  const hubY = capY + 0.6;
  const hubZ = 1.65;
  const rotor = new THREE.Group();
  rotor.name = 'WindmillBlades';
  rotor.position.set(0, hubY, hubZ);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), ironMat);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const sailLength = 3.6;
  const sailWidth = 0.85;

  for (let i = 0; i < 4; i++) {
    const sailArm = new THREE.Group();
    sailArm.rotation.z = (i * Math.PI) / 2;

    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, sailLength, 0.12), sailFrameMat);
    spar.position.y = sailLength / 2 + 0.25;
    spar.castShadow = true;
    sailArm.add(spar);

    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(sailWidth, sailLength * 0.78), clothMat);
    canvas.position.set(sailWidth / 2, sailLength * 0.6 + 0.2, 0.05);
    canvas.rotation.y = 0.18;
    sailArm.add(canvas);

    rotor.add(sailArm);
  }

  root.add(rotor);
  return root;
}

export function buildTrainStationProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TrainStation';

  const platformMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });
  const platformEdgeMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.6 });
  const wallWoodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
  const creamTrimMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, roughness: 0.6 });
  const roofGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.55 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.8, roughness: 0.3 });
  const sleeperWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 });

  const platLen = 7.2;
  const platW = 3.4;
  const platH = 0.45;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(platLen, platH, platW), platformMat);
  platform.position.set(0, platH / 2, 0);
  platform.receiveShadow = true;
  root.add(platform);

  const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.05, 0.15), platformEdgeMat);
  edgeLine.position.set(0, platH + 0.01, platW / 2 - 0.1);
  root.add(edgeLine);

  const bldgW = 4.4;
  const bldgD = 1.9;
  const bldgH = 2.4;
  const bldgY = platH + bldgH / 2;
  const bldgZ = -0.6;

  const depot = new THREE.Mesh(new THREE.BoxGeometry(bldgW, bldgH, bldgD), wallWoodMat);
  depot.position.set(0, bldgY, bldgZ);
  depot.castShadow = true;
  root.add(depot);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-bldgD / 2 - 0.3, 0);
  roofShape.lineTo(0, 1.2);
  roofShape.lineTo(bldgD / 2 + 0.3, 0);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: bldgW + 0.6, bevelEnabled: false });
  roofGeo.center();
  const depotRoof = new THREE.Mesh(roofGeo, roofGreenMat);
  depotRoof.position.set(0, platH + bldgH + 0.6, bldgZ);
  depotRoof.rotation.y = Math.PI / 2;
  depotRoof.castShadow = true;
  root.add(depotRoof);

  const canopyLen = 5.2;
  const canopyDepth = 1.6;
  const canopyH = 0.15;
  const canopyY = platH + 2.3;
  const canopyZ = bldgZ + bldgD / 2 + canopyDepth / 2;

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(canopyLen, canopyH, canopyDepth), roofGreenMat);
  canopy.position.set(0, canopyY, canopyZ);
  canopy.castShadow = true;
  root.add(canopy);

  [-1.8, 0, 1.8].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), creamTrimMat);
    post.position.set(px, platH + 1.15, canopyZ + canopyDepth / 2 - 0.1);
    post.castShadow = true;
    root.add(post);
  });

  // Track sleepers + rails
  const trackZ1 = platW / 2 + 0.7;
  const trackZ2 = platW / 2 + 1.7;
  const trackLen = platLen + 2.0;

  for (let i = 0; i < 14; i++) {
    const tx = -trackLen / 2 + (i / 13) * trackLen;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.4), sleeperWoodMat);
    tie.position.set(tx, 0.06, (trackZ1 + trackZ2) / 2);
    root.add(tie);
  }

  [trackZ1, trackZ2].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(trackLen, 0.1, 0.06), railSteelMat);
    rail.position.set(0, 0.16, rz);
    root.add(rail);
  });

  return root;
}

export function buildPowerLineProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'PowerLine';

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.7, roughness: 0.35 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.95 });
  const insulatorMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.3 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 });

  const baseSpan = 1.3;
  const waistH = 5.0;
  const waistSpan = 0.45;
  const corners = [
    { x: -baseSpan / 2, z: -baseSpan / 2 },
    { x: baseSpan / 2, z: -baseSpan / 2 },
    { x: baseSpan / 2, z: baseSpan / 2 },
    { x: -baseSpan / 2, z: baseSpan / 2 },
  ];

  corners.forEach(({ x, z }) => {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.45, 8), concreteMat);
    pier.position.set(x, 0.22, z);
    root.add(pier);

    const topX = Math.sign(x) * (waistSpan / 2);
    const topZ = Math.sign(z) * (waistSpan / 2);
    const legVec = new THREE.Vector3(topX - x, waistH, topZ - z);
    const legLen = legVec.length();

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, legLen, 6), steelMat);
    leg.position.set((x + topX) / 2, 0.35 + waistH / 2, (z + topZ) / 2);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), legVec.clone().normalize());
    leg.castShadow = true;
    root.add(leg);
  });

  const arm1Y = 0.35 + waistH + 0.4;
  const arm1Span = 3.6;
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(arm1Span, 0.08, 0.08), steelMat);
  arm1.position.set(0, arm1Y, 0);
  arm1.castShadow = true;
  root.add(arm1);

  const arm2Y = arm1Y + 1.2;
  const arm2Span = 2.6;
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(arm2Span, 0.08, 0.08), steelMat);
  arm2.position.set(0, arm2Y, 0);
  arm2.castShadow = true;
  root.add(arm2);

  const conductorPoints = [
    { x: -arm1Span / 2 + 0.15, y: arm1Y },
    { x: arm1Span / 2 - 0.15, y: arm1Y },
    { x: -arm2Span / 2 + 0.15, y: arm2Y },
    { x: arm2Span / 2 - 0.15, y: arm2Y },
  ];

  conductorPoints.forEach(({ x, y }) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.24, 8), insulatorMat);
    disc.position.set(x, y - 0.2, 0);
    root.add(disc);

    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.2, 6), wireMat);
    wire.position.set(x, y - 0.35, 0);
    wire.rotation.x = Math.PI / 2;
    root.add(wire);
  });

  return root;
}

export function buildSpookyLampPostProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SpookyLampPost';

  const wroughtIronMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.85, roughness: 0.4 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d, roughness: 0.95 });
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffd54f,
    emissive: 0xff9800,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    transparent: true,
    opacity: 0.9,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.5, 8), stoneMat);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const columnH = 3.2;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, columnH, 8), wroughtIronMat);
  col.position.y = 0.6 + columnH / 2;
  col.castShadow = true;
  root.add(col);

  const bracketArm = new THREE.Group();
  bracketArm.position.set(0, 3.6, 0);

  const archCurve = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.045, 8, 16, Math.PI * 0.6), wroughtIronMat);
  archCurve.position.set(0, 0.45, 0.45);
  archCurve.rotation.y = Math.PI / 2;
  bracketArm.add(archCurve);

  const lanternY = -0.15;
  const lanternZ = 0.85;

  const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 6), wroughtIronMat);
  lCap.position.set(0, lanternY + 0.35, lanternZ);
  bracketArm.add(lCap);

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.48, 6), lanternGlassMat);
  glass.position.set(0, lanternY + 0.05, lanternZ);
  bracketArm.add(glass);

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), wroughtIronMat);
    bar.position.set(Math.cos(ang) * 0.25, lanternY + 0.05, lanternZ + Math.sin(ang) * 0.25);
    bracketArm.add(bar);
  }

  root.add(bracketArm);
  return root;
}

export function buildTractorProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FarmTractor';

  const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.45 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7, roughness: 0.35 });
  const tireRubberMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 });
  const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.4 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff9c4, emissiveIntensity: 0.6 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.6), darkMetalMat);
  chassis.position.set(0, 0.65, 0);
  chassis.castShadow = true;
  root.add(chassis);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 1.6), redMat);
  hood.position.set(0, 1.15, 0.55);
  hood.castShadow = true;
  root.add(hood);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.15), darkMetalMat);
  grille.position.set(0, 1.15, 1.4);
  root.add(grille);

  [-0.42, 0.42].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 8), darkMetalMat);
    lamp.position.set(lx, 1.25, 1.4);
    lamp.rotation.x = Math.PI / 2;
    root.add(lamp);

    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), headlightMat);
    bulb.position.set(lx, 1.25, 1.47);
    root.add(bulb);
  });

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), darkMetalMat);
  exhaust.position.set(0.35, 1.9, 0.8);
  root.add(exhaust);

  [-0.72, 0.72].forEach((fx) => {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 1.3), redMat);
    fender.position.set(fx, 1.35, -0.6);
    fender.castShadow = true;
    root.add(fender);
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.06), seatMat);
  seat.position.set(0, 1.42, -0.82);
  root.add(seat);

  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 12), darkMetalMat);
  steerWheel.position.set(0, 1.6, -0.35);
  steerWheel.rotation.x = 1.0;
  root.add(steerWheel);

  [-0.85, 0.85].forEach((wx) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.42, 16), tireRubberMat);
    tire.position.set(wx, 0.75, -0.65);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    root.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.44, 12), wheelRimMat);
    rim.position.set(wx, 0.75, -0.65);
    rim.rotation.z = Math.PI / 2;
    root.add(rim);
  });

  [-0.6, 0.6].forEach((wx) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 12), tireRubberMat);
    tire.position.set(wx, 0.38, 0.95);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    root.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.24, 8), wheelRimMat);
    rim.position.set(wx, 0.38, 0.95);
    rim.rotation.z = Math.PI / 2;
    root.add(rim);
  });

  return root;
}

export function buildVillageProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'RuralVillage';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
  const cobblestoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xa87148, roughness: 0.85 });
  const roofRedMat = new THREE.MeshStandardMaterial({ color: 0xb5532e, roughness: 0.7 });
  const roofBrownMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.75 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, roughness: 0.15 });

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 8.2), cobblestoneMat);
  plaza.position.y = 0.1;
  plaza.receiveShadow = true;
  root.add(plaza);

  const well = new THREE.Group();
  well.position.set(0, 0.2, 0);
  const wellStone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.8, 10), stoneMat);
  wellStone.position.y = 0.4;
  wellStone.castShadow = true;
  well.add(wellStone);

  const wellWater = new THREE.Mesh(new THREE.CircleGeometry(0.78, 10), waterMat);
  wellWater.position.y = 0.65;
  wellWater.rotation.x = -Math.PI / 2;
  well.add(wellWater);

  const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.85, 4), roofBrownMat);
  wellRoof.position.y = 1.9;
  wellRoof.rotation.y = Math.PI / 4;
  wellRoof.castShadow = true;
  well.add(wellRoof);
  root.add(well);

  const c1 = new THREE.Group();
  c1.position.set(-2.4, 0.2, -2.4);
  const c1Body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 2.4), stoneMat);
  c1Body.position.y = 1.1;
  c1Body.castShadow = true;
  c1.add(c1Body);
  const c1Roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 4), roofRedMat);
  c1Roof.position.y = 2.8;
  c1Roof.rotation.y = Math.PI / 4;
  c1Roof.castShadow = true;
  c1.add(c1Roof);
  root.add(c1);

  const c2 = new THREE.Group();
  c2.position.set(2.4, 0.2, -2.2);
  const c2Body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.6), woodPlankMat);
  c2Body.position.y = 0.9;
  c2Body.castShadow = true;
  c2.add(c2Body);
  const c2Roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 4), roofBrownMat);
  c2Roof.position.y = 2.4;
  c2Roof.rotation.y = Math.PI / 4;
  c2Roof.castShadow = true;
  c2.add(c2Roof);
  root.add(c2);

  return root;
}

export function buildUtilityPoleProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'UtilityPole';

  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.75, roughness: 0.35 });
  const transformerMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.6, roughness: 0.4 });
  const insulatorMat = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.2 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 });

  const poleH = 6.8;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, poleH, 8), timberMat);
  pole.position.y = poleH / 2;
  pole.castShadow = true;
  root.add(pole);

  const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10), transformerMat);
  transformer.position.set(0, 4.2, 0.38);
  transformer.castShadow = true;
  root.add(transformer);

  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.12), timberMat);
  arm1.position.set(0, 5.8, 0);
  arm1.castShadow = true;
  root.add(arm1);

  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.1), timberMat);
  arm2.position.set(0, 6.4, 0);
  arm2.castShadow = true;
  root.add(arm2);

  [-1.25, 1.25, -0.8, 0.8].forEach((x, i) => {
    const y = i < 2 ? 5.8 : 6.4;
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.14, 6), insulatorMat);
    ins.position.set(x, y + 0.12, 0);
    root.add(ins);

    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.8, 4), wireMat);
    wire.position.set(x, y + 0.18, 0);
    wire.rotation.x = Math.PI / 2;
    root.add(wire);
  });

  return root;
}

export function buildFireEscapeProcedural(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FireEscape';

  const blackIronMat = new THREE.MeshStandardMaterial({ color: 0x212529, metalness: 0.8, roughness: 0.4 });
  const gratingMat = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.75, roughness: 0.5 });

  [1.6, 3.6].forEach((yLvl) => {
    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.6), gratingMat);
    grate.position.set(0, yLvl, 0);
    grate.castShadow = true;
    root.add(grate);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.6), blackIronMat);
    rail.position.set(-0.72, yLvl + 0.9, 0);
    root.add(rail);

    for (let p = 0; p < 5; p++) {
      const z = -1.1 + (p / 4) * 2.2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), blackIronMat);
      post.position.set(-0.72, yLvl + 0.45, z);
      root.add(post);
    }
  });

  for (let s = 0; s < 8; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.26), gratingMat);
    step.position.set(0.3, 1.6 + s * 0.25, 0.9 - s * 0.25);
    step.castShadow = true;
    root.add(step);
  }

  [-0.18, 0.18].forEach((lx) => {
    const lRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), blackIronMat);
    lRail.position.set(lx, 0.8, -1.0);
    root.add(lRail);
  });

  return root;
}


// scripts/generate_structures.ts
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// FileReader polyfill for Node.js
if (typeof globalThis.FileReader === 'undefined') {
  class MockFileReader {
    onloadend: any;
    result: any;
    readAsArrayBuffer(blob: any) {
      blob.arrayBuffer().then((buf: ArrayBuffer) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
      });
    }
  }
  (globalThis as any).FileReader = MockFileReader;
}

// ─────────────────────────────────────────────────────────────
// 1. WATER TOWER MODEL (หอส่งน้ำ/แท็งก์น้ำฟาร์ม)
// ─────────────────────────────────────────────────────────────
function buildWaterTower(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'WaterTower';

  // Materials
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 }); // Barrel planks
  const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 }); // Legs & beams
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.35 }); // Hoops & pipes
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb5532e, roughness: 0.6 }); // Shingle roof cone
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.95 }); // Footing piers
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.5, roughness: 0.4 });
  const waterGaugeMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, emissive: 0x01579b, emissiveIntensity: 0.3 });

  // 1. Concrete Footings (4 piers)
  const legRadius = 1.6;
  const legH = 4.2;
  const legAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

  legAngles.forEach((ang) => {
    const x = Math.cos(ang) * legRadius;
    const z = Math.sin(ang) * legRadius;

    // Concrete pier
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.5, 8), concreteMat);
    pier.position.set(x, 0.25, z);
    root.add(pier);

    // Sturdy wooden leg (slanted inward slightly towards the top)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, legH, 0.24), woodDarkMat);
    leg.position.set(x * 0.9, 0.5 + legH / 2, z * 0.9);
    // Slight tilt inward
    leg.rotation.y = -ang;
    leg.rotation.z = 0.05 * (x > 0 ? -1 : 1);
    root.add(leg);
  });

  // 2. Horizontal & Cross X-Bracing
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
      root.add(beam);
    }
  });

  // Cross X-braces between levels
  const xBracePairs = [
    { y1: 0.6, y2: 1.8 },
    { y1: 1.8, y2: 3.2 },
    { y1: 3.2, y2: 4.5 },
  ];
  xBracePairs.forEach(({ y1, y2 }) => {
    for (let i = 0; i < 4; i++) {
      const a1 = legAngles[i];
      const a2 = legAngles[(i + 1) % 4];
      const r = legRadius * 0.9;
      const x1 = Math.cos(a1) * r;
      const z1 = Math.sin(a1) * r;
      const x2 = Math.cos(a2) * r;
      const z2 = Math.sin(a2) * r;
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const horizDist = Math.hypot(x2 - x1, z2 - z1);
      const vertDist = y2 - y1;
      const diagLen = Math.hypot(horizDist, vertDist);
      const angleY = -Math.atan2(z2 - z1, x2 - x1);

      // Brace 1
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.08, 0.08), woodDarkMat);
      b1.position.set(midX, (y1 + y2) / 2, midZ);
      b1.rotation.y = angleY;
      b1.rotation.z = Math.atan2(vertDist, horizDist);
      root.add(b1);

      // Brace 2 (opposite diagonal)
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.08, 0.08), woodDarkMat);
      b2.position.set(midX, (y1 + y2) / 2, midZ);
      b2.rotation.y = angleY;
      b2.rotation.z = -Math.atan2(vertDist, horizDist);
      root.add(b2);
    }
  });

  // 3. Platform Deck & Catwalk
  const deckY = 4.7;
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.2, 16), woodDarkMat);
  platform.position.y = deckY;
  root.add(platform);

  // Platform Railing
  const railingH = 0.8;
  const railingMat = metalMat;
  const railRadius = 2.0;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    // Post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, railingH, 6), railingMat);
    post.position.set(Math.cos(ang) * railRadius, deckY + railingH / 2, Math.sin(ang) * railRadius);
    root.add(post);
  }
  // Circular ring rail
  const topRail = new THREE.Mesh(new THREE.TorusGeometry(railRadius, 0.04, 6, 24), railingMat);
  topRail.position.y = deckY + railingH;
  topRail.rotation.x = Math.PI / 2;
  root.add(topRail);

  // 4. Large Wooden Water Barrel / Tank
  const tankRadius = 1.7;
  const tankH = 2.4;
  const tankY = deckY + 0.1 + tankH / 2;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankRadius, tankRadius * 1.05, tankH, 20), woodMat);
  tank.position.y = tankY;
  root.add(tank);

  // Metal Hoops around tank
  [-0.9, -0.3, 0.3, 0.9].forEach((yOffset) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(tankRadius * 1.03, 0.04, 6, 24), metalMat);
    hoop.position.y = tankY + yOffset;
    hoop.rotation.x = Math.PI / 2;
    root.add(hoop);
  });

  // 5. Conical Roof
  const roofH = 1.4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(tankRadius * 1.25, roofH, 20), roofMat);
  roof.position.y = tankY + tankH / 2 + roofH / 2;
  root.add(roof);

  // Finial Ball at top of cone
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), metalMat);
  finial.position.y = tankY + tankH / 2 + roofH + 0.15;
  root.add(finial);

  // 6. Access Ladder climbing up one side
  const ladderZ = legRadius * 0.9 + 0.15;
  const ladderH = deckY + railingH;
  const rungCount = 14;
  // Rails
  [-0.2, 0.2].forEach((lx) => {
    const lRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ladderH, 6), ladderMat);
    lRail.position.set(lx, ladderH / 2, ladderZ);
    root.add(lRail);
  });
  // Rungs
  for (let i = 1; i <= rungCount; i++) {
    const ry = (i / (rungCount + 1)) * ladderH;
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), ladderMat);
    rung.position.set(0, ry, ladderZ);
    rung.rotation.z = Math.PI / 2;
    root.add(rung);
  }

  // 7. Water Discharge Pipe & Valve
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, deckY, 8), metalMat);
  pipe.position.set(0, deckY / 2, 0);
  root.add(pipe);

  // Faucet / tap valve at bottom
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), metalMat);
  valve.position.set(0, 0.8, 0.3);
  valve.rotation.x = Math.PI / 2;
  root.add(valve);

  // Spigot handle
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), waterGaugeMat);
  handle.position.set(0, 0.8, 0.6);
  root.add(handle);

  return root;
}

// ─────────────────────────────────────────────────────────────
// 2. WINDMILL MODEL (กังหันลมโบราณฟาร์ม)
// ─────────────────────────────────────────────────────────────
function buildWindmill(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Windmill';

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 0.95 }); // Masonry base
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.8 }); // White-washed wood
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 }); // Beams & trims
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 }); // Dome / cap
  const sailFrameMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 }); // Blade wood
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9, side: THREE.DoubleSide }); // Canvas sails
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7, roughness: 0.3 }); // Hub & rotor
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.85 });

  // 1. Masonry Stone Octagonal Base (Height: 2m)
  const baseH = 2.0;
  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, baseH, 8), stoneMat);
  baseMesh.position.y = baseH / 2;
  root.add(baseMesh);

  // Foundation Stone Trim
  const baseTrim = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.85, 0.3, 8), timberMat);
  baseTrim.position.y = 0.15;
  root.add(baseTrim);

  // Arched Entryway Door
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.2), timberMat);
  doorFrame.position.set(0, 0.8, 2.45);
  root.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.45, 0.15), doorMat);
  door.position.set(0, 0.8, 2.48);
  root.add(door);

  // 2. Middle Wooden Tower (Tapered, Height: 4.2m)
  const midH = 4.2;
  const midMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.25, midH, 8), woodPlankMat);
  midMesh.position.y = baseH + midH / 2;
  root.add(midMesh);

  // Horizontal timber belt band
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.28, 0.25, 8), timberMat);
  belt.position.y = baseH;
  root.add(belt);

  // Balcony gallery walkway around upper mid tower
  const galleryY = baseH + midH * 0.7;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.18, 16), timberMat);
  gallery.position.y = galleryY;
  root.add(gallery);

  // Gallery Railing
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), timberMat);
    post.position.set(Math.cos(ang) * 2.42, galleryY + 0.32, Math.sin(ang) * 2.42);
    root.add(post);
  }
  const railRing = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.04, 6, 24), timberMat);
  railRing.position.y = galleryY + 0.65;
  railRing.rotation.x = Math.PI / 2;
  root.add(railRing);

  // Small windows
  [
    { y: baseH + 1.2, ang: Math.PI / 2 },
    { y: baseH + 1.2, ang: -Math.PI / 2 },
    { y: baseH + 3.0, ang: 0 },
    { y: baseH + 3.0, ang: Math.PI },
  ].forEach((w) => {
    const wx = Math.sin(w.ang) * 1.9;
    const wz = Math.cos(w.ang) * 1.9;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.15), timberMat);
    win.position.set(wx, w.y, wz);
    win.rotation.y = w.ang;
    root.add(win);
  });

  // 3. Rotating Cap / Dome at top (Height: 1.6m)
  const capY = baseH + midH;
  const capRing = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.2, 16), timberMat);
  capRing.position.y = capY;
  root.add(capRing);

  // Dome cap
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 16), roofMat);
  cap.position.y = capY + 0.8;
  root.add(cap);

  // Tail rudder vane at back
  const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), timberMat);
  tailBoom.position.set(0, capY + 0.6, -1.8);
  root.add(tailBoom);
  const rudderVane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.9), clothMat);
  rudderVane.position.set(0, capY + 0.7, -2.8);
  root.add(rudderVane);

  // 4. Rotor Hub & 4 Sails / Blades
  const hubY = capY + 0.6;
  const hubZ = 1.65;
  const rotor = new THREE.Group();
  rotor.name = 'WindmillBlades';
  rotor.position.set(0, hubY, hubZ);

  // Iron Hub Axle
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), ironMat);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  // Hub nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 12), ironMat);
  nose.position.z = 0.35;
  nose.rotation.x = Math.PI / 2;
  rotor.add(nose);

  // 4 Large Lattice Sails with Canvas
  const sailLength = 3.6;
  const sailWidth = 0.85;

  for (let i = 0; i < 4; i++) {
    const sailArm = new THREE.Group();
    sailArm.rotation.z = (i * Math.PI) / 2;

    // Main wooden spar / stock
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, sailLength, 0.12), sailFrameMat);
    spar.position.y = sailLength / 2 + 0.25;
    sailArm.add(spar);

    // Canvas Sail Cloth on one side of spar
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(sailWidth, sailLength * 0.78), clothMat);
    canvas.position.set(sailWidth / 2, sailLength * 0.6 + 0.2, 0.05);
    // Slight aerodynamic twist
    canvas.rotation.y = 0.18;
    sailArm.add(canvas);

    // Lattice frame bars
    const barCount = 7;
    for (let b = 0; b < barCount; b++) {
      const by = sailLength * 0.25 + (b / (barCount - 1)) * (sailLength * 0.75);
      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(sailWidth, 0.04, 0.04), sailFrameMat);
      crossBar.position.set(sailWidth / 2, by, 0.06);
      sailArm.add(crossBar);
    }

    rotor.add(sailArm);
  }

  root.add(rotor);
  return root;
}

// ─────────────────────────────────────────────────────────────
// 3. TRAIN STATION MODEL (สถานีรถไฟฟาร์ม / รถไฟชนบท)
// ─────────────────────────────────────────────────────────────
function buildTrainStation(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TrainStation';

  // Materials
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 }); // Platform concrete
  const platformEdgeMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.6 }); // Yellow safety edge
  const wallWoodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 }); // Redwood planks
  const creamTrimMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, roughness: 0.6 }); // Cream trims & frames
  const roofGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.55 }); // Classic green corrugated roof
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.8, roughness: 0.3 }); // Steel rails
  const sleeperWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 }); // Railway ties / sleepers
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa, roughness: 0.2, transparent: true, opacity: 0.7 });
  const clockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.5 }); // Station sign

  // 1. Train Platform (Raised wooden/concrete passenger deck)
  // Dimensions: 7.2m long (X), 3.4m wide (Z), 0.45m high (Y)
  const platLen = 7.2;
  const platW = 3.4;
  const platH = 0.45;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(platLen, platH, platW), platformMat);
  platform.position.set(0, platH / 2, 0);
  root.add(platform);

  // Yellow Safety Caution Line along front platform edge (Z = +platW/2)
  const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.05, 0.15), platformEdgeMat);
  edgeLine.position.set(0, platH + 0.01, platW / 2 - 0.1);
  root.add(edgeLine);

  // Platform Access Steps on left and right ends
  [-platLen / 2 - 0.35, platLen / 2 + 0.35].forEach((sx) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, platH * 0.5, 1.4), platformMat);
    step.position.set(sx, platH * 0.25, 0);
    root.add(step);
  });

  // 2. Station Depot Building (Placed on back half of platform, Z = -0.5)
  const bldgW = 4.4;
  const bldgD = 1.9;
  const bldgH = 2.4;
  const bldgY = platH + bldgH / 2;
  const bldgZ = -0.6;

  const depot = new THREE.Mesh(new THREE.BoxGeometry(bldgW, bldgH, bldgD), wallWoodMat);
  depot.position.set(0, bldgY, bldgZ);
  root.add(depot);

  // Cream Base Plinth Trim
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(bldgW + 0.1, 0.3, bldgD + 0.1), creamTrimMat);
  plinth.position.set(0, platH + 0.15, bldgZ);
  root.add(plinth);

  // Main Depot Roof (Gabled pitched roof)
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
  root.add(depotRoof);

  // 3. Platform Canopy Overhang (protecting passengers waiting on the platform)
  const canopyLen = 5.2;
  const canopyDepth = 1.6;
  const canopyH = 0.15;
  const canopyY = platH + 2.3;
  const canopyZ = bldgZ + bldgD / 2 + canopyDepth / 2;

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(canopyLen, canopyH, canopyDepth), roofGreenMat);
  canopy.position.set(0, canopyY, canopyZ);
  root.add(canopy);

  // Canopy Wooden Support Pillars (3 posts)
  [-1.8, 0, 1.8].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), creamTrimMat);
    post.position.set(px, platH + 1.15, canopyZ + canopyDepth / 2 - 0.1);
    root.add(post);

    // Diagonal decorative bracket
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), creamTrimMat);
    bracket.position.set(px, platH + 2.05, canopyZ + canopyDepth / 2 - 0.25);
    bracket.rotation.x = Math.PI / 4;
    root.add(bracket);
  });

  // 4. Ticket Window & Waiting Room Door
  // Waiting room door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.1), creamTrimMat);
  door.position.set(-0.9, platH + 0.8, bldgZ + bldgD / 2 + 0.05);
  root.add(door);

  // Ticket window
  const ticketWindow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), creamTrimMat);
  ticketWindow.position.set(0.9, platH + 1.2, bldgZ + bldgD / 2 + 0.05);
  root.add(ticketWindow);
  const ticketGlass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.12), glassMat);
  ticketGlass.position.set(0.9, platH + 1.2, bldgZ + bldgD / 2 + 0.05);
  root.add(ticketGlass);

  // Station Master Clock hanging under canopy
  const clockArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), railSteelMat);
  clockArm.position.set(0, canopyY - 0.2, canopyZ);
  root.add(clockArm);
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), clockMat);
  clock.position.set(0, canopyY - 0.4, canopyZ);
  clock.rotation.z = Math.PI / 2;
  root.add(clock);

  // Station Name Signboard ("BEAM STATION")
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.08), signMat);
  sign.position.set(0, canopyY + 0.25, canopyZ + canopyDepth / 2);
  root.add(sign);

  // Waiting Benches on Platform
  [-1.2, 1.2].forEach((bx) => {
    // Bench seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.35), sleeperWoodMat);
    seat.position.set(bx, platH + 0.38, 0.35);
    root.add(seat);
    // Bench legs
    [-0.35, 0.35].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.25), railSteelMat);
      leg.position.set(bx + lx, platH + 0.19, 0.35);
      root.add(leg);
    });
    // Bench backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.05), sleeperWoodMat);
    back.position.set(bx, platH + 0.58, 0.2);
    root.add(back);
  });

  // 5. Traditional Railway Signal Pole (Semaphore)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), railSteelMat);
  pole.position.set(platLen / 2 - 0.5, platH + 1.6, platW / 2 - 0.3);
  root.add(pole);

  // Signal indicator arm (Green / Go)
  const signalArm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.04), roofGreenMat);
  signalArm.position.set(platLen / 2 - 0.2, platH + 2.8, platW / 2 - 0.3);
  signalArm.rotation.z = -0.4;
  root.add(signalArm);

  // 6. Railway Tracks in Front of Platform (Sleepers + Steel Rails)
  const trackZ1 = platW / 2 + 0.7; // First rail
  const trackZ2 = platW / 2 + 1.7; // Second rail
  const trackLen = platLen + 2.0;

  // Sleepers / Wooden Ties
  const tieCount = 14;
  for (let i = 0; i < tieCount; i++) {
    const tx = -trackLen / 2 + (i / (tieCount - 1)) * trackLen;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.4), sleeperWoodMat);
    tie.position.set(tx, 0.06, (trackZ1 + trackZ2) / 2);
    root.add(tie);
  }

  // Steel Rails
  [trackZ1, trackZ2].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(trackLen, 0.1, 0.06), railSteelMat);
    rail.position.set(0, 0.16, rz);
    root.add(rail);
  });

  return root;
}

// ─────────────────────────────────────────────────────────────
// 4. POWER LINE MODEL (เสาไฟฟ้าแรงสูงฟาร์ม)
// ─────────────────────────────────────────────────────────────
function buildPowerLine(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'PowerLine';

  // Materials
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.7, roughness: 0.35 }); // Galvanized lattice steel
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.95 }); // Foundation piers
  const insulatorMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.3 }); // Ceramic bell insulators
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 }); // Conductor cables
  const warningMat = new THREE.MeshStandardMaterial({ color: 0xf57f17, roughness: 0.5 }); // Danger high-voltage sign

  // 1. Concrete Foundation Footings (4 piers)
  const baseSpan = 1.3;
  const pylonH = 7.5;
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
  });

  // 2. Four Main Corner Lattice Legs (Tapering from 1.3m at base to 0.45m at waist)
  const waistH = 5.0;
  const waistSpan = 0.45;
  corners.forEach(({ x, z }) => {
    const topX = Math.sign(x) * (waistSpan / 2);
    const topZ = Math.sign(z) * (waistSpan / 2);

    const legVec = new THREE.Vector3(topX - x, waistH, topZ - z);
    const legLen = legVec.length();

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, legLen, 6), steelMat);
    leg.position.set((x + topX) / 2, 0.35 + waistH / 2, (z + topZ) / 2);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), legVec.clone().normalize());
    root.add(leg);
  });

  // 3. Horizontal Belt Rings & Diagonal X-Braces along the tower body
  const ringLevels = [1.2, 2.3, 3.5, 4.8];
  ringLevels.forEach((yLvl) => {
    const t = yLvl / waistH;
    const currentSpan = THREE.MathUtils.lerp(baseSpan, waistSpan, t);

    // 4 horizontal beams
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      const x1 = Math.sign(c1.x) * (currentSpan / 2);
      const z1 = Math.sign(c1.z) * (currentSpan / 2);
      const x2 = Math.sign(c2.x) * (currentSpan / 2);
      const z2 = Math.sign(c2.z) * (currentSpan / 2);
      const dist = Math.hypot(x2 - x1, z2 - z1);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.05, 0.05), steelMat);
      beam.position.set((x1 + x2) / 2, 0.35 + yLvl, (z1 + z2) / 2);
      beam.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      root.add(beam);
    }
  });

  // Cross X-braces between ring levels
  for (let r = 0; r < ringLevels.length - 1; r++) {
    const y1 = ringLevels[r];
    const y2 = ringLevels[r + 1];
    const span1 = THREE.MathUtils.lerp(baseSpan, waistSpan, y1 / waistH);
    const span2 = THREE.MathUtils.lerp(baseSpan, waistSpan, y2 / waistH);

    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      const midX = (Math.sign(c1.x) + Math.sign(c2.x)) * 0.25 * ((span1 + span2) / 2);
      const midZ = (Math.sign(c1.z) + Math.sign(c2.z)) * 0.25 * ((span1 + span2) / 2);
      const dH = (span1 + span2) / 2;
      const dV = y2 - y1;
      const diagLen = Math.hypot(dH, dV);
      const angleY = -Math.atan2(Math.sign(c2.z) - Math.sign(c1.z), Math.sign(c2.x) - Math.sign(c1.x));

      // Diagonal 1
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.035, 0.035), steelMat);
      b1.position.set(midX, 0.35 + (y1 + y2) / 2, midZ);
      b1.rotation.y = angleY;
      b1.rotation.z = Math.atan2(dV, dH);
      root.add(b1);

      // Diagonal 2
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.035, 0.035), steelMat);
      b2.position.set(midX, 0.35 + (y1 + y2) / 2, midZ);
      b2.rotation.y = angleY;
      b2.rotation.z = -Math.atan2(dV, dH);
      root.add(b2);
    }
  }

  // 4. Upper Tower & Crossarms (Spanning X axis)
  // Crossarm 1 (Lower / wider crossarm)
  const arm1Y = 0.35 + waistH + 0.4;
  const arm1Span = 3.6;
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(arm1Span, 0.08, 0.08), steelMat);
  arm1.position.set(0, arm1Y, 0);
  root.add(arm1);

  // Under-arm triangle support trusses
  [-0.9, 0.9].forEach((tx) => {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), steelMat);
    truss.position.set(tx, arm1Y - 0.25, 0);
    truss.rotation.z = (tx > 0 ? -1 : 1) * 0.45;
    root.add(truss);
  });

  // Crossarm 2 (Upper crossarm)
  const arm2Y = arm1Y + 1.2;
  const arm2Span = 2.6;
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(arm2Span, 0.08, 0.08), steelMat);
  arm2.position.set(0, arm2Y, 0);
  root.add(arm2);

  // Upper pylon peak & lightning rod
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.15, 1.0, 4), steelMat);
  peak.position.set(0, arm2Y + 0.6, 0);
  root.add(peak);

  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.7, 6), steelMat);
  spike.position.set(0, arm2Y + 1.25, 0);
  root.add(spike);

  // 5. Ceramic Insulator Strings & Power Lines
  // 4 main power line conductor attachment points: 2 on arm 1 (outer), 2 on arm 2
  const conductorPoints = [
    { x: -arm1Span / 2 + 0.15, y: arm1Y },
    { x: arm1Span / 2 - 0.15, y: arm1Y },
    { x: -arm2Span / 2 + 0.15, y: arm2Y },
    { x: arm2Span / 2 - 0.15, y: arm2Y },
  ];

  conductorPoints.forEach(({ x, y }) => {
    // Hanging insulator string (3 ceramic bell discs)
    const insGroup = new THREE.Group();
    insGroup.position.set(x, y - 0.3, 0);
    for (let d = 0; d < 3; d++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.08, 8), insulatorMat);
      disc.position.y = -d * 0.1;
      insGroup.add(disc);
    }
    root.add(insGroup);

    // Cable running horizontally through the insulator clamp (along Z axis)
    const wireLength = 4.2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, wireLength, 6), wireMat);
    wire.position.set(x, y - 0.62, 0);
    wire.rotation.x = Math.PI / 2;
    root.add(wire);
  });

  // 6. Danger High-Voltage Caution Sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.04), warningMat);
  sign.position.set(0, 1.8, baseSpan / 2 - 0.15);
  root.add(sign);

  return root;
}

// ─────────────────────────────────────────────────────────────
// EXPORT ALL 4 MODELS TO /public/*.glb
// ─────────────────────────────────────────────────────────────
async function generateAll() {
  const models = [
    { name: 'water-tower.glb', build: buildWaterTower },
    { name: 'windmill.glb', build: buildWindmill },
    { name: 'train-station.glb', build: buildTrainStation },
    { name: 'power-line.glb', build: buildPowerLine },
  ];

  const exporter = new GLTFExporter();
  const outDir = path.resolve('public');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating 4 GLB models for public/ ...');

  for (const m of models) {
    const scene = new THREE.Scene();
    const group = m.build();
    scene.add(group);

    try {
      const result = await exporter.parseAsync(scene, { binary: true });
      const buf = Buffer.from(result as ArrayBuffer);
      const filePath = path.join(outDir, m.name);
      fs.writeFileSync(filePath, buf);
      console.log(`Generated ${m.name} (${buf.byteLength} bytes)`);
    } catch (err) {
      console.error(`Failed to export ${m.name}:`, err);
    }
  }

  console.log('Finished exporting all models successfully!');
}

generateAll();

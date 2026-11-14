// scripts/generate_more_structures.ts
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
// 1. MAN FARMER CHARACTER MODEL (ชาวไร่หนุ่ม man.glb)
// ─────────────────────────────────────────────────────────────
function buildManFarmer(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ManFarmer';

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf3b890, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.75 }); // Red plaid flannel
  const denimMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.8 }); // Blue denim overalls
  const denimPocketMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.8, roughness: 0.25 });
  const strawHatMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.85 });
  const hatRibbonMat = new THREE.MeshStandardMaterial({ color: 0x880e4f, roughness: 0.6 });
  const leatherBootMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x212121 });

  // 1. Pelvis & Hips
  const pelvis = new THREE.Group();
  pelvis.name = 'Pelvis';
  pelvis.position.y = 0.95;
  root.add(pelvis);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.28, 12), denimMat);
  hips.position.y = -0.05;
  hips.castShadow = true;
  pelvis.add(hips);

  // 2. Spine & Chest (Flannel Shirt + Overalls Bib)
  const chest = new THREE.Group();
  chest.name = 'Chest';
  chest.position.y = 0.22;
  pelvis.add(chest);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.42, 12), shirtMat);
  torso.scale.set(1.05, 1.0, 0.8);
  torso.position.y = 0.2;
  torso.castShadow = true;
  chest.add(torso);

  // Overalls Bib & Front Pocket
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.06), denimMat);
  bib.position.set(0, 0.18, 0.17);
  chest.add(bib);

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.02), denimPocketMat);
  pocket.position.set(0, 0.16, 0.205);
  chest.add(pocket);

  // Straps & Brass Buckles
  [-0.12, 0.12].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.03), denimMat);
    strap.position.set(sx, 0.22, 0.16);
    chest.add(strap);

    const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8), brassMat);
    buckle.position.set(sx, 0.32, 0.18);
    buckle.rotation.x = Math.PI / 2;
    chest.add(buckle);
  });

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 10), skinMat);
  neck.position.y = 0.44;
  chest.add(neck);

  // 3. Head & Face
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.y = 0.62;
  chest.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  face.scale.set(0.95, 1.05, 0.95);
  head.add(face);

  // Hair
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairBack.position.set(0, 0.03, -0.02);
  head.add(hairBack);

  // Eyes & Cheerful Smile
  [-0.07, 0.07].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
    eye.position.set(ex, 0.03, 0.2);
    head.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), skinMat);
  nose.position.set(0, 0.0, 0.22);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);

  // Straw Hat
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 0.14, -0.02);
  hatGroup.rotation.x = -0.08;

  // Brim
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 20), strawHatMat);
  hatGroup.add(brim);

  // Crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 16), strawHatMat);
  crown.position.y = 0.11;
  hatGroup.add(crown);

  // Crimson Ribbon
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.282, 0.05, 16), hatRibbonMat);
  ribbon.position.y = 0.04;
  hatGroup.add(ribbon);

  head.add(hatGroup);

  // 4. Arms
  [-1, 1].forEach((side) => {
    const armGroup = new THREE.Group();
    armGroup.name = side === 1 ? 'RightArm' : 'LeftArm';
    armGroup.position.set(side * 0.32, 0.34, 0);

    // Shoulder / Upper Arm
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.3, 10), shirtMat);
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    // Forearm
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.28, 10), skinMat);
    forearm.position.set(0, -0.4, 0.04);
    forearm.rotation.x = 0.2;
    forearm.castShadow = true;
    armGroup.add(forearm);

    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), skinMat);
    hand.position.set(0, -0.56, 0.08);
    armGroup.add(hand);

    chest.add(armGroup);
  });

  // 5. Legs & Work Boots
  [-1, 1].forEach((side) => {
    const legGroup = new THREE.Group();
    legGroup.name = side === 1 ? 'RightLeg' : 'LeftLeg';
    legGroup.position.set(side * 0.14, -0.1, 0);

    // Thigh
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.42, 10), denimMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Calf
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.4, 10), denimMat);
    calf.position.y = -0.58;
    calf.castShadow = true;
    legGroup.add(calf);

    // Leather Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), leatherBootMat);
    boot.position.set(0, -0.82, 0.05);
    boot.castShadow = true;
    legGroup.add(boot);

    pelvis.add(legGroup);
  });

  return root;
}

// ─────────────────────────────────────────────────────────────
// 2. SPOOKY LAMP POST (เสาไฟสไตล์สปุกกี้ spooky-lamp-post.glb)
// ─────────────────────────────────────────────────────────────
function buildSpookyLampPost(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SpookyLampPost';

  // Materials
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
  const webMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.9, transparent: true, opacity: 0.6 });

  // 1. Mossy Stone Base Pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.5, 8), stoneMat);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const baseTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.46, 0.15, 8), wroughtIronMat);
  baseTrim.position.y = 0.55;
  root.add(baseTrim);

  // 2. Iron Column with Victorian Fluting (Height: 3.5m)
  const columnH = 3.2;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, columnH, 8), wroughtIronMat);
  col.position.y = 0.6 + columnH / 2;
  col.castShadow = true;
  root.add(col);

  // Decorative Iron Knots / Collars
  [1.4, 2.4, 3.4].forEach((y) => {
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 12), wroughtIronMat);
    knot.position.y = y;
    knot.rotation.x = Math.PI / 2;
    root.add(knot);
  });

  // 3. Spooky Arched Curled Bracket (reaching out in +Z)
  const bracketArm = new THREE.Group();
  bracketArm.position.set(0, 3.6, 0);

  // Curved iron arch
  const archCurve = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.045, 8, 16, Math.PI * 0.6), wroughtIronMat);
  archCurve.position.set(0, 0.45, 0.45);
  archCurve.rotation.y = Math.PI / 2;
  bracketArm.add(archCurve);

  // Decorative Spooky Curls / Gothic Flourish
  const curl1 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI * 1.5), wroughtIronMat);
  curl1.position.set(0, 0.2, 0.3);
  curl1.rotation.y = Math.PI / 2;
  bracketArm.add(curl1);

  // Spooky Bat Finial at apex
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 6), wroughtIronMat);
  finial.position.set(0, 0.85, 0);
  bracketArm.add(finial);

  // Spooky web accent between post and arm
  const web = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), webMat);
  web.position.set(0, 0.3, 0.22);
  web.rotation.y = Math.PI / 2;
  bracketArm.add(web);

  // 4. Hexagonal Hanging Lantern Cage
  const lanternY = -0.15;
  const lanternZ = 0.85;

  // Suspension chain
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), wroughtIronMat);
  chain.position.set(0, 0.25, lanternZ);
  bracketArm.add(chain);

  // Lantern Cap (Pointed hexagon)
  const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 6), wroughtIronMat);
  lCap.position.set(0, lanternY + 0.35, lanternZ);
  bracketArm.add(lCap);

  // Glowing Lantern Glass Body
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.48, 6), lanternGlassMat);
  glass.position.set(0, lanternY + 0.05, lanternZ);
  bracketArm.add(glass);

  // Cage Frame Bars
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), wroughtIronMat);
    bar.position.set(Math.cos(ang) * 0.25, lanternY + 0.05, lanternZ + Math.sin(ang) * 0.25);
    bracketArm.add(bar);
  }

  // Lantern Base
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.1, 6), wroughtIronMat);
  lBase.position.set(0, lanternY - 0.22, lanternZ);
  bracketArm.add(lBase);

  // Hanging spike drop
  const drop = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), wroughtIronMat);
  drop.position.set(0, lanternY - 0.35, lanternZ);
  drop.rotation.x = Math.PI;
  bracketArm.add(drop);

  root.add(bracketArm);
  return root;
}

// ─────────────────────────────────────────────────────────────
// 3. TRACTOR MODEL (รถแทรกเตอร์ฟาร์ม tractor.glb)
// ─────────────────────────────────────────────────────────────
function buildTractor(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FarmTractor';

  // Materials
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.45 }); // Farmall Cherry Red
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7, roughness: 0.35 });
  const tireRubberMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 });
  const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.4 }); // Classic yellow wheel rim
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.15 });
  const headlightGlassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff9c4, emissiveIntensity: 0.6 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });

  // 1. Chassis Frame & Transmission Belly
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.6), darkMetalMat);
  chassis.position.set(0, 0.65, 0);
  chassis.castShadow = true;
  root.add(chassis);

  // 2. Engine Hood / Bonnet (Front +Z)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 1.6), redMat);
  hood.position.set(0, 1.15, 0.55);
  hood.castShadow = true;
  root.add(hood);

  // Radiator Front Grille & Louvers
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.15), darkMetalMat);
  grille.position.set(0, 1.15, 1.4);
  root.add(grille);

  // Chrome Headlights
  [-0.42, 0.42].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 10), chromeMat);
    lamp.position.set(lx, 1.25, 1.4);
    lamp.rotation.x = Math.PI / 2;
    root.add(lamp);

    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), headlightGlassMat);
    bulb.position.set(lx, 1.25, 1.47);
    root.add(bulb);
  });

  // Vertical Exhaust Chimney Stack with Flap
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), darkMetalMat);
  exhaust.position.set(0.35, 1.9, 0.8);
  root.add(exhaust);

  const exhaustCap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), darkMetalMat);
  exhaustCap.position.set(0.35, 2.45, 0.8);
  exhaustCap.rotation.z = 0.2;
  root.add(exhaustCap);

  // Air Cleaner Canister
  const airFilter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8), darkMetalMat);
  airFilter.position.set(-0.38, 1.7, 0.7);
  root.add(airFilter);

  // 3. Driver Station (Steering Wheel, Seat, Mudguards)
  // Rear curved mudguards / fenders
  [-0.72, 0.72].forEach((fx) => {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 1.3), redMat);
    fender.position.set(fx, 1.35, -0.6);
    fender.castShadow = true;
    root.add(fender);
  });

  // Spring-mounted pan seat
  const seatSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), darkMetalMat);
  seatSpring.position.set(0, 1.05, -0.6);
  seatSpring.rotation.x = -0.3;
  root.add(seatSpring);

  const seatPan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.08, 12), seatMat);
  seatPan.position.set(0, 1.25, -0.68);
  root.add(seatPan);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.06), seatMat);
  seatBack.position.set(0, 1.42, -0.82);
  root.add(seatBack);

  // Steering Column & Wheel
  const steerColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), darkMetalMat);
  steerColumn.position.set(0, 1.35, -0.2);
  steerColumn.rotation.x = -0.55;
  root.add(steerColumn);

  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16), darkMetalMat);
  steerWheel.position.set(0, 1.6, -0.35);
  steerWheel.rotation.x = 1.0;
  root.add(steerWheel);

  // 4. Heavy Agricultural Wheels
  // Rear Wheels (Massive diameter 1.5m, width 0.45m)
  [-0.85, 0.85].forEach((wx) => {
    // Tire
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.42, 16), tireRubberMat);
    tire.position.set(wx, 0.75, -0.65);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    root.add(tire);

    // Yellow Steel Rim & Hub
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.44, 12), wheelRimMat);
    rim.position.set(wx, 0.75, -0.65);
    rim.rotation.z = Math.PI / 2;
    root.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.48, 8), darkMetalMat);
    hub.position.set(wx, 0.75, -0.65);
    hub.rotation.z = Math.PI / 2;
    root.add(hub);
  });

  // Front Wheels (Smaller steering tires, diameter 0.75m)
  [-0.6, 0.6].forEach((wx) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 14), tireRubberMat);
    tire.position.set(wx, 0.38, 0.95);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    root.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.24, 10), wheelRimMat);
    rim.position.set(wx, 0.38, 0.95);
    rim.rotation.z = Math.PI / 2;
    root.add(rim);
  });

  // 5. Rear Tow Hitch & Hydraulic Lift Links
  const hitch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.45), darkMetalMat);
  hitch.position.set(0, 0.45, -1.4);
  root.add(hitch);

  return root;
}

// ─────────────────────────────────────────────────────────────
// 4. VILLAGE MODEL (หมู่บ้านชนบท village.glb)
// ─────────────────────────────────────────────────────────────
function buildVillage(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'RuralVillage';

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
  const cobblestoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xa87148, roughness: 0.85 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
  const roofRedMat = new THREE.MeshStandardMaterial({ color: 0xb5532e, roughness: 0.7 });
  const roofBrownMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.75 });
  const roofGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.65 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, roughness: 0.15, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff59d, emissive: 0xffb74d, emissiveIntensity: 0.4 });
  const flowerRed = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.6 });

  // 1. Village Cobblestone Courtyard / Plaza (8m x 8m)
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 8.2), cobblestoneMat);
  plaza.position.y = 0.1;
  plaza.receiveShadow = true;
  root.add(plaza);

  // 2. Central Wishing Well in Village Square
  const well = new THREE.Group();
  well.position.set(0, 0.2, 0);

  const wellStone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.8, 12), stoneMat);
  wellStone.position.y = 0.4;
  wellStone.castShadow = true;
  well.add(wellStone);

  const wellWater = new THREE.Mesh(new THREE.CircleGeometry(0.78, 12), waterMat);
  wellWater.position.y = 0.65;
  wellWater.rotation.x = -Math.PI / 2;
  well.add(wellWater);

  // Well roof posts
  [-0.7, 0.7].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), timberMat);
    post.position.set(px, 1.1, 0);
    well.add(post);
  });

  const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.85, 4), roofBrownMat);
  wellRoof.position.y = 2.0;
  wellRoof.rotation.y = Math.PI / 4;
  wellRoof.castShadow = true;
  well.add(wellRoof);

  root.add(well);

  // 3. Cottage 1: Main Stone Country House (North-West, X: -2.3, Z: -2.3)
  const c1 = new THREE.Group();
  c1.position.set(-2.4, 0.2, -2.4);

  const c1Body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 2.4), stoneMat);
  c1Body.position.y = 1.1;
  c1Body.castShadow = true;
  c1.add(c1Body);

  const c1RoofShape = new THREE.Shape();
  c1RoofShape.moveTo(-1.5, 0);
  c1RoofShape.lineTo(0, 1.3);
  c1RoofShape.lineTo(1.5, 0);
  c1RoofShape.closePath();
  const c1RoofGeo = new THREE.ExtrudeGeometry(c1RoofShape, { depth: 2.7, bevelEnabled: false });
  c1RoofGeo.center();
  const c1Roof = new THREE.Mesh(c1RoofGeo, roofRedMat);
  c1Roof.position.set(0, 2.85, 0);
  c1Roof.rotation.y = Math.PI / 2;
  c1Roof.castShadow = true;
  c1.add(c1Roof);

  // Windows with warm light
  [-0.7, 0.7].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.1), glassMat);
    win.position.set(wx, 1.3, 1.22);
    c1.add(win);
  });

  root.add(c1);

  // 4. Cottage 2: Village Bakery / Barn (North-East, X: 2.4, Z: -2.2)
  const c2 = new THREE.Group();
  c2.position.set(2.4, 0.2, -2.2);

  const c2Body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.6), woodPlankMat);
  c2Body.position.y = 0.9;
  c2Body.castShadow = true;
  c2.add(c2Body);

  const c2RoofShape = new THREE.Shape();
  c2RoofShape.moveTo(-1.45, 0);
  c2RoofShape.lineTo(0, 1.1);
  c2RoofShape.lineTo(1.45, 0);
  c2RoofShape.closePath();
  const c2RoofGeo = new THREE.ExtrudeGeometry(c2RoofShape, { depth: 2.8, bevelEnabled: false });
  c2RoofGeo.center();
  const c2Roof = new THREE.Mesh(c2RoofGeo, roofBrownMat);
  c2Roof.position.set(0, 2.35, 0);
  c2Roof.rotation.y = Math.PI / 2;
  c2Roof.castShadow = true;
  c2.add(c2Roof);

  root.add(c2);

  // 5. Cottage 3: Rural Green Store / Cottage (South-West, X: -2.2, Z: 2.3)
  const c3 = new THREE.Group();
  c3.position.set(-2.2, 0.2, 2.3);

  const c3Body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.9, 2.2), stoneMat);
  c3Body.position.y = 0.95;
  c3Body.castShadow = true;
  c3.add(c3Body);

  const c3RoofShape = new THREE.Shape();
  c3RoofShape.moveTo(-1.3, 0);
  c3RoofShape.lineTo(0, 1.0);
  c3RoofShape.lineTo(1.3, 0);
  c3RoofShape.closePath();
  const c3RoofGeo = new THREE.ExtrudeGeometry(c3RoofShape, { depth: 2.7, bevelEnabled: false });
  c3RoofGeo.center();
  const c3Roof = new THREE.Mesh(c3RoofGeo, roofGreenMat);
  c3Roof.position.set(0, 2.4, 0);
  c3Roof.rotation.y = Math.PI / 2;
  c3Roof.castShadow = true;
  c3.add(c3Roof);

  // Flower Box
  const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.22), timberMat);
  flowerBox.position.set(0, 0.7, 1.15);
  c3.add(flowerBox);

  const flowerBloom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.16), flowerRed);
  flowerBloom.position.set(0, 0.8, 1.15);
  c3.add(flowerBloom);

  root.add(c3);

  return root;
}

// ─────────────────────────────────────────────────────────────
// 5. UTILITY POLE MODEL (เสาไฟฟ้าไม้ / โทรเลข utility-pole.glb)
// ─────────────────────────────────────────────────────────────
function buildUtilityPole(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'UtilityPole';

  // Materials
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.75, roughness: 0.35 });
  const transformerMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.6, roughness: 0.4 });
  const insulatorMat = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.2, metalness: 0.1 }); // Turquoise glass insulator
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 });

  // 1. Tall Wooden Utility Pole (Height: 6.8m, tapered)
  const poleH = 6.8;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, poleH, 10), timberMat);
  pole.position.y = poleH / 2;
  pole.castShadow = true;
  root.add(pole);

  // 2. Concrete Base Collar / Foundation ring
  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.45, 8), steelMat);
  baseCollar.position.y = 0.22;
  root.add(baseCollar);

  // 3. Staggered Climbing Iron Steps / Rungs along pole
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const y = 1.2 + i * 0.55;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), steelMat);
    step.position.set(side * 0.16, y, 0);
    root.add(step);
  }

  // 4. Pole-Mounted Distribution Transformer (Drum)
  const transY = 4.2;
  const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.85, 12), transformerMat);
  transformer.position.set(0, transY, 0.38);
  transformer.castShadow = true;
  root.add(transformer);

  // Transformer mounting bracket bands
  [-0.25, 0.25].forEach((by) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.6), steelMat);
    band.position.set(0, transY + by, 0.18);
    root.add(band);
  });

  // Transformer porcelain bushings on top
  [-0.1, 0.1].forEach((bx) => {
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.22, 8), insulatorMat);
    bushing.position.set(bx, transY + 0.52, 0.38);
    root.add(bushing);
  });

  // 5. Dual Timber Crossarms near Top (Width: 2.8m and 2.0m)
  // Lower crossarm
  const arm1Y = 5.8;
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.12), timberMat);
  arm1.position.set(0, arm1Y, 0);
  arm1.castShadow = true;
  root.add(arm1);

  // Steel V-brace struts under arm 1
  [-0.6, 0.6].forEach((sx) => {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.035, 0.035), steelMat);
    brace.position.set(sx, arm1Y - 0.22, 0);
    brace.rotation.z = (sx > 0 ? -1 : 1) * 0.52;
    root.add(brace);
  });

  // Upper crossarm
  const arm2Y = 6.4;
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.1), timberMat);
  arm2.position.set(0, arm2Y, 0);
  arm2.castShadow = true;
  root.add(arm2);

  // 6. Glass Pin Insulators & Wires
  const insulatorSpots = [
    { x: -1.25, y: arm1Y },
    { x: -0.65, y: arm1Y },
    { x: 0.65, y: arm1Y },
    { x: 1.25, y: arm1Y },
    { x: -0.8, y: arm2Y },
    { x: 0.8, y: arm2Y },
  ];

  insulatorSpots.forEach(({ x, y }) => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.14, 8), insulatorMat);
    ins.position.set(x, y + 0.12, 0);
    root.add(ins);

    // Power wire running horizontally in Z direction
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.8, 6), wireMat);
    wire.position.set(x, y + 0.18, 0);
    wire.rotation.x = Math.PI / 2;
    root.add(wire);
  });

  return root;
}

// ─────────────────────────────────────────────────────────────
// 6. FIRE ESCAPE MODEL (บันไดหนีไฟเหล็ก fire-escape.glb)
// ─────────────────────────────────────────────────────────────
function buildFireEscape(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FireEscape';

  // Materials
  const blackIronMat = new THREE.MeshStandardMaterial({ color: 0x212529, metalness: 0.8, roughness: 0.4 });
  const gratingMat = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.75, roughness: 0.5 });
  const brassPulleyMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.8, roughness: 0.3 });

  // 1. Two-Tier Industrial Steel Fire Escape
  // Platform Dimensions: Width (X) 1.5m, Depth (Z) 2.6m
  const tiers = [1.6, 3.6];

  tiers.forEach((yLvl, idx) => {
    const platGroup = new THREE.Group();
    platGroup.position.set(0, yLvl, 0);

    // Steel Platform Grate
    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.6), gratingMat);
    grate.castShadow = true;
    platGroup.add(grate);

    // Perimeter Handrails (Height: 0.9m)
    const railH = 0.9;
    // Outer long rail (X = -0.75)
    const longTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.6), blackIronMat);
    longTopRail.position.set(-0.72, railH, 0);
    platGroup.add(longTopRail);

    // Vertical railing baluster posts
    for (let p = 0; p < 7; p++) {
      const z = -1.2 + (p / 6) * 2.4;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, 0.04), blackIronMat);
      post.position.set(-0.72, railH / 2, z);
      platGroup.add(post);
    }

    // Short end rails
    [-1.28, 1.28].forEach((rz) => {
      const endRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), blackIronMat);
      endRail.position.set(0, railH, rz);
      platGroup.add(endRail);

      for (let p = 0; p < 3; p++) {
        const x = -0.5 + p * 0.5;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, 0.04), blackIronMat);
        post.position.set(x, railH / 2, rz);
        platGroup.add(post);
      }
    });

    root.add(platGroup);
  });

  // 2. Angled Zig-Zag Connecting Stairs (From Tier 2 to Tier 1)
  const stairSteps = 10;
  const dy = 2.0 / stairSteps;
  const dz = 2.0 / stairSteps;

  for (let s = 0; s < stairSteps; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.24), gratingMat);
    step.position.set(0.3, 1.6 + s * dy, 1.0 - s * dz);
    step.castShadow = true;
    root.add(step);
  }

  // Stair Diagonal Stringer Channels
  [-0.05, 0.65].forEach((sx) => {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 2.9), blackIronMat);
    stringer.position.set(sx, 2.6, 0.0);
    stringer.rotation.x = Math.atan2(2.0, 2.0);
    root.add(stringer);
  });

  // 3. Ground Drop Ladder with Counterweight Pulley (From Tier 1 towards Ground)
  const ladderH = 1.6;
  const ladderZ = -1.0;
  [-0.18, 0.18].forEach((lx) => {
    const lRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ladderH, 6), blackIronMat);
    lRail.position.set(lx, ladderH / 2, ladderZ);
    root.add(lRail);
  });

  for (let r = 1; r < 7; r++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), blackIronMat);
    rung.position.set(0, (r / 7) * ladderH, ladderZ);
    rung.rotation.z = Math.PI / 2;
    root.add(rung);
  }

  // Counterweight drum & pulley
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), brassPulleyMat);
  pulley.position.set(0.28, 1.7, ladderZ);
  pulley.rotation.z = Math.PI / 2;
  root.add(pulley);

  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.25, 0.14), blackIronMat);
  counterweight.position.set(0.28, 1.2, ladderZ);
  root.add(counterweight);

  // 4. Heavy Structural Wall Brackets (Mounting to the back, +X)
  [1.6, 3.6].forEach((yLvl) => {
    [-1.0, 1.0].forEach((bz) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), blackIronMat);
      bracket.position.set(0.95, yLvl, bz);
      root.add(bracket);
    });
  });

  return root;
}

// ─────────────────────────────────────────────────────────────
// EXPORT ALL 6 MODELS
// ─────────────────────────────────────────────────────────────
async function generateAll() {
  const models = [
    { name: 'man.glb', build: buildManFarmer },
    { name: 'spooky-lamp-post.glb', build: buildSpookyLampPost },
    { name: 'tractor.glb', build: buildTractor },
    { name: 'village.glb', build: buildVillage },
    { name: 'utility-pole.glb', build: buildUtilityPole },
    { name: 'fire-escape.glb', build: buildFireEscape },
  ];

  const exporter = new GLTFExporter();
  const outDir = path.resolve('public');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating 6 new GLB models for public/ ...');

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

  console.log('Finished exporting all 6 models successfully!');
}

generateAll();

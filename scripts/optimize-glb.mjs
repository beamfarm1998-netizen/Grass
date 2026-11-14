#!/usr/bin/env node
/**
 * optimize-glb.mjs — ลดขนาด GLB ทั้งโฟลเดอร์ตามงบใน src/config/modelBudgets.json
 *
 * ติดตั้ง (ครั้งเดียว):
 *   npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
 *
 * ใช้งาน:
 *   node scripts/optimize-glb.mjs --dry-run          # ดูรายงานก่อน ไม่แก้ไฟล์
 *   node scripts/optimize-glb.mjs                    # ทำจริง (สำรองต้นฉบับที่ public-original-glb/)
 *   node scripts/optimize-glb.mjs --only "Grass on a rock"
 *   node scripts/optimize-glb.mjs --no-meshopt       # ไม่บีบ geometry (ไม่ต้องใช้ decoder ฝั่งเกม)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const IN_DIR = path.resolve(root, opt('in', 'public'));
const OUT_DIR = path.resolve(root, opt('out', 'public'));
const BACKUP_DIR = path.resolve(root, opt('backup', 'public-original-glb'));
const ONLY = opt('only', '').toLowerCase();
const DRY = flag('dry-run');
const USE_MESHOPT = !flag('no-meshopt');

const cfg = JSON.parse(fs.readFileSync(path.join(root, 'src/config/modelBudgets.json'), 'utf8'));

let core, ext, fn, meshoptimizer, sharp;
try {
  core = await import('@gltf-transform/core');
  ext = await import('@gltf-transform/extensions');
  fn = await import('@gltf-transform/functions');
  meshoptimizer = await import('meshoptimizer');
  sharp = (await import('sharp')).default;
} catch (e) {
  console.error('ขาดแพ็กเกจ รันคำสั่งนี้ก่อน:\n  npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp\n\n' + e.message);
  process.exit(1);
}
const { NodeIO } = core;
const { ALL_EXTENSIONS } = ext;
const { dedup, prune, weld, simplify, resample, textureCompress, meshopt } = fn;
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = meshoptimizer;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function categoryOf(file) {
  const name = path.basename(file).toLowerCase();
  for (const r of cfg.rules) if (new RegExp(r.match, 'i').test(name)) return r.category;
  return 'building';
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.glb')) out.push(p);
  }
  return out;
}

function countTris(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      t += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0;
    }
  return Math.round(t);
}

const fmt = (b) => (b / 1048576).toFixed(2) + ' MB';
const files = walk(IN_DIR).filter((f) => !f.startsWith(BACKUP_DIR) && (!ONLY || f.toLowerCase().includes(ONLY)));
console.log(`พบ GLB ${files.length} ไฟล์ ใน ${path.relative(root, IN_DIR)}  (${DRY ? 'DRY-RUN' : 'ทำจริง'}, meshopt=${USE_MESHOPT})\n`);

const rows = [];
let totalBefore = 0, totalAfter = 0;

for (const file of files) {
  const rel = path.relative(IN_DIR, file);
  const cat = categoryOf(file);
  const budget = cfg.categories[cat];
  const before = fs.statSync(file).size;
  totalBefore += before;
  try {
    const doc = await io.read(file);
    const r = doc.getRoot();
    const skinned = r.listSkins().length > 0;
    const animated = r.listAnimations().length > 0;
    const trisBefore = countTris(doc);

    const steps = [dedup(), prune()];
    if (animated) steps.push(resample());
    steps.push(weld());
    // ลดสามเหลี่ยมเฉพาะโมเดลที่ไม่มีโครงกระดูก (simplify ทำ skin weights เพี้ยน)
    if (!skinned && trisBefore > budget.maxTris) {
      steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.05, budget.maxTris / trisBefore), error: 0.02 }));
    }
    // ย่อ texture ตามงบ + แปลงเป็น WebP (three.js อ่านได้เอง ไม่ต้องใช้ decoder)
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [budget.maxTexture, budget.maxTexture] }));
    if (USE_MESHOPT) steps.push(meshopt({ encoder: MeshoptEncoder, level: 'high' }));

    await doc.transform(...steps);
    const trisAfter = countTris(doc);
    const buf = await io.writeBinary(doc);
    let after = before;

    if (buf.byteLength < before) {
      after = buf.byteLength;
      if (!DRY) {
        const bk = path.join(BACKUP_DIR, rel);
        if (!fs.existsSync(bk)) { fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.copyFileSync(file, bk); }
        const outFile = path.join(OUT_DIR, rel);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, buf);
      }
    }
    totalAfter += after;
    const over = after > budget.maxKB * 1024;
    rows.push({ file: rel, cat, before, after, trisBefore, trisAfter, over, skinned });
    console.log(`${over ? '⚠️ ' : '✅'} ${rel.padEnd(48)} ${fmt(before).padStart(9)} → ${fmt(after).padStart(9)}  tris ${trisBefore}→${trisAfter}  [${cat} ≤ ${budget.maxKB}KB]${skinned ? ' (skinned: ไม่ลด tris)' : ''}`);
  } catch (e) {
    totalAfter += before;
    rows.push({ file: rel, cat, before, after: before, error: e.message });
    console.log(`❌ ${rel}: ${e.message}`);
  }
}

console.log(`\nรวมก่อน ${fmt(totalBefore)} → หลัง ${fmt(totalAfter)}  (ลด ${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}%)`);
const over = rows.filter((x) => x.over);
if (over.length) {
  console.log(`\n⚠️ ยังเกินงบ ${over.length} ไฟล์ (ต้องลดมือใน Blender หรือแทนด้วยโมเดลเบากว่า):`);
  for (const x of over) console.log(`   - ${x.file}  ${fmt(x.after)}  (${x.cat})`);
}
if (!DRY) console.log(`\nต้นฉบับสำรองที่ ${path.relative(root, BACKUP_DIR)}/ (ใส่ .gitignore และไม่ให้เข้า APK)`);
fs.writeFileSync(path.join(root, 'glb-optimize-report.json'), JSON.stringify(rows, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { AssetLoaderAndValidator } from '../../src/engine/animation/AssetLoaderAndValidator';

describe('GLB 3D Asset Pipeline Validation', () => {
  const models = [
    { key: 'fish_base', relPath: 'public/assets/models/fish/lake_fish.glb' },
    { key: 'rod_base', relPath: 'public/assets/models/equipment/fishing_rod.glb' },
    { key: 'rock_base', relPath: 'public/assets/models/environments/lake_rock.glb' },
  ];

  for (const item of models) {
    it(`loads and validates binary glTF 2.0 model: ${item.relPath}`, async () => {
      const fullPath = path.resolve(item.relPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const fileBuf = fs.readFileSync(fullPath);
      // Verify binary glTF magic header 'glTF' (0x46546C67) and version 2
      expect(fileBuf.readUInt32LE(0)).toBe(0x46546c67);
      expect(fileBuf.readUInt32LE(4)).toBe(2);

      const arrayBuffer = fileBuf.buffer.slice(
        fileBuf.byteOffset,
        fileBuf.byteOffset + fileBuf.byteLength
      );

      const loader = new GLTFLoader();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.parse(arrayBuffer, '', resolve, reject);
      });

      const report = AssetLoaderAndValidator.validateSceneRoot(
        item.key,
        item.relPath,
        gltf.scene,
        gltf.animations
      );

      expect(report.valid, `Validation issues: ${report.issues.join(', ')}`).toBe(true);
      expect(report.meshCount).toBeGreaterThan(0);
      expect(report.vertexCount).toBeGreaterThan(20);
      expect(report.hasMaterial).toBe(true);
      expect(report.hasValidBounds).toBe(true);
    });
  }
});

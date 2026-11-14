import * as THREE from 'three';
import { CameraPreset } from '../../core/GameConfig';
import { FishingState } from '../../systems/fishing/FishingState';
import { WaterPhysics } from '../../systems/physics/water/WaterPhysics';

const _desiredPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();

export class CameraManager {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly currentTarget = new THREE.Vector3(0, 0.4, -4);
  private preset: CameraPreset = 'angler';
  private userYawOffset = 0;
  private userPitchOffset = 0;
  private wasInFightPhase = false;
  private manualAboveWaterDuringFight = false;

  constructor(width: number, height: number) {
    const aspect = Math.max(0.2, width / Math.max(1, height));
    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.12, 240);
    this.camera.position.set(0, 2.75, 16.35);
    this.camera.lookAt(this.currentTarget);
  }

  setPreset(preset: CameraPreset): void {
    this.preset = preset;
    this.userYawOffset = 0;
    this.userPitchOffset = 0;
    if (this.wasInFightPhase) {
      this.manualAboveWaterDuringFight = preset !== 'underwater';
    }
  }

  getPreset(): CameraPreset {
    return this.preset;
  }

  getEffectivePreset(fishingState: FishingState): CameraPreset {
    const isFightPhase =
      fishingState === FishingState.HOOKED ||
      fishingState === FishingState.FIGHTING ||
      fishingState === FishingState.REELING;
    if (isFightPhase && !this.manualAboveWaterDuringFight) {
      return 'underwater';
    }
    return this.preset;
  }

  addLookDrag(deltaX: number, deltaY: number): void {
    this.userYawOffset = THREE.MathUtils.clamp(this.userYawOffset - deltaX * 0.0028, -0.55, 0.55);
    this.userPitchOffset = THREE.MathUtils.clamp(this.userPitchOffset - deltaY * 0.002, -0.25, 0.28);
  }

  /**
   * Returns 0 when camera is above water, smoothly ramping to 1 when submerged below the lake surface.
   */
  getUnderwaterFactor(elapsed = 0): number {
    const surfY = WaterPhysics.waveHeightAt(this.camera.position.x, this.camera.position.z, elapsed);
    const depthBelow = surfY - this.camera.position.y;
    return THREE.MathUtils.clamp((depthBelow - 0.01) / 0.18, 0, 1);
  }

  resize(width: number, height: number): void {
    const aspect = Math.max(0.2, width / Math.max(1, height));
    this.camera.aspect = aspect;
    // Slightly wider vertical clearance on portrait mobile viewports
    this.camera.fov = aspect < 1 ? 64 : 54;
    this.camera.updateProjectionMatrix();
  }

  update(
    dt: number,
    elapsed: number,
    fishingState: FishingState,
    dockTip: { x: number; y: number; z: number },
    bobberPos: THREE.Vector3,
    aimAngleDeg: number,
    lineTensionRatio: number,
    fishVelX = 0,
    fishVelY = 0,
    fishVelZ = 0
  ): void {
    const aimRad = THREE.MathUtils.degToRad(aimAngleDeg) + this.userYawOffset;
    const isFightPhase =
      fishingState === FishingState.HOOKED ||
      fishingState === FishingState.FIGHTING ||
      fishingState === FishingState.REELING;

    if (isFightPhase && !this.wasInFightPhase) {
      this.manualAboveWaterDuringFight = false;
    } else if (!isFightPhase) {
      this.manualAboveWaterDuringFight = false;
    }
    this.wasInFightPhase = isFightPhase;

    const useUnderwaterFightCam =
      isFightPhase && (this.preset === 'underwater' || !this.manualAboveWaterDuringFight);

    if (
      fishingState === FishingState.LANDED ||
      fishingState === FishingState.RESULT
    ) {
      // Showcase trophy camera framing the landed fish in front of the angler on the pier
      _desiredPos.set(dockTip.x + 0.35, dockTip.y + 1.42, dockTip.z + 1.85);
      _desiredTarget.set(dockTip.x, dockTip.y + 0.95, dockTip.z - 1.15);
    } else if (useUnderwaterFightCam) {
      // Underwater Fight Chase Camera: pans beneath the waves to show the fish running & thrashing
      const toFishX = bobberPos.x - dockTip.x;
      const toFishZ = bobberPos.z - dockTip.z;
      const horizDist = Math.max(0.001, Math.hypot(toFishX, toFishZ));
      const dirX = toFishX / horizDist;
      const dirZ = toFishZ / horizDist;
      // Perpendicular side vector in XZ plane for dramatic 3/4 side-angle framing when fish sprints
      const perpX = -dirZ;
      const perpZ = dirX;

      const trailDist = this.preset === 'bobber' ? 1.85 : 2.35;
      const sideLead = THREE.MathUtils.clamp(-fishVelX * 0.28, -0.82, 0.82) + Math.sin(this.userYawOffset) * 1.15;

      const camX = bobberPos.x - dirX * trailDist + perpX * sideLead;
      const camZ = bobberPos.z - dirZ * trailDist + perpZ * sideLead;

      const bedY = WaterPhysics.terrainHeightAt(camX, camZ);
      const surfY = WaterPhysics.waveHeightAt(camX, camZ, elapsed);
      const maxSubmergedY = surfY - 0.36;
      const minSafeBedY = bedY + 0.32;

      const desiredSubmergedY = bobberPos.y + 0.08 + this.userPitchOffset * 0.4;
      const camY =
        minSafeBedY < maxSubmergedY
          ? THREE.MathUtils.clamp(desiredSubmergedY, minSafeBedY, maxSubmergedY)
          : Math.min(maxSubmergedY, bedY + 0.18);

      _desiredPos.set(camX, camY, camZ);
      _desiredTarget.set(
        bobberPos.x + fishVelX * 0.26,
        Math.min(surfY - 0.32, bobberPos.y + 0.02 + fishVelY * 0.12),
        bobberPos.z + fishVelZ * 0.26
      );
    } else if (this.preset === 'underwater') {
      // Dedicated Underwater Scout Camera during IDLE / CASTING / WAITING / BITE
      const focusX = fishingState === FishingState.IDLE ? dockTip.x + Math.sin(aimRad) * 9.5 : bobberPos.x;
      const focusZ = fishingState === FishingState.IDLE ? dockTip.z - Math.cos(aimRad) * 9.5 : bobberPos.z;
      const camX = focusX + Math.sin(this.userYawOffset) * 2.2;
      const camZ = focusZ + 3.4;
      const bedY = WaterPhysics.terrainHeightAt(camX, camZ);
      const surfY = WaterPhysics.waveHeightAt(camX, camZ, elapsed);
      const camY = THREE.MathUtils.clamp(-0.95 + this.userPitchOffset * 0.5, bedY + 0.35, surfY - 0.38);

      _desiredPos.set(camX, camY, camZ);
      _desiredTarget.set(focusX, Math.min(surfY - 0.28, -0.52), focusZ - 0.6);
    } else if (this.preset === 'cinematic') {
      const sway = Math.sin(elapsed * 0.22) * 1.4;
      _desiredPos.set(11.5 + sway, 6.8, 20.5);
      _desiredTarget.set(bobberPos.x * 0.35, 0.3, -4);
    } else if (
      this.preset === 'bobber' &&
      (fishingState === FishingState.WAITING || fishingState === FishingState.BITE)
    ) {
      _desiredPos.set(bobberPos.x + 2.2, Math.max(1.35, bobberPos.y + 1.65), bobberPos.z + 4.4);
      _desiredTarget.set(bobberPos.x, bobberPos.y - 0.1, bobberPos.z);
    } else {
      // Default immersive angler viewpoint on the wooden pier
      _desiredPos.set(
        dockTip.x - Math.sin(aimRad) * 0.55,
        dockTip.y + 1.62 + this.userPitchOffset * 0.8,
        dockTip.z + 2.15
      );

      if (
        fishingState === FishingState.CASTING ||
        fishingState === FishingState.WAITING ||
        fishingState === FishingState.BITE
      ) {
        _desiredTarget.set(
          bobberPos.x,
          Math.max(-0.6, bobberPos.y + 0.15 + this.userPitchOffset * 2.5),
          bobberPos.z
        );
      } else {
        _desiredTarget.set(
          dockTip.x + Math.sin(aimRad) * 14,
          0.35 + this.userPitchOffset * 4.5,
          dockTip.z - Math.cos(aimRad) * 14
        );
      }
    }

    // Subtle organic fight micro-shake when tension approaches break limit
    if (isFightPhase && lineTensionRatio > 0.72) {
      const shakeAmp = (lineTensionRatio - 0.72) * 0.048;
      _desiredPos.x += Math.sin(elapsed * 43) * shakeAmp;
      _desiredPos.y += Math.cos(elapsed * 37) * shakeAmp;
    }

    const smoothLambda = isFightPhase ? 6.4 : fishingState === FishingState.BITE ? 7.5 : 5.2;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _desiredPos.x, smoothLambda, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _desiredPos.y, smoothLambda, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _desiredPos.z, smoothLambda, dt);

    const targetLambda = isFightPhase ? 9.5 : smoothLambda + 1.5;
    this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, _desiredTarget.x, targetLambda, dt);
    this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, _desiredTarget.y, targetLambda, dt);
    this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, _desiredTarget.z, targetLambda, dt);

    this.camera.lookAt(this.currentTarget);
  }
}

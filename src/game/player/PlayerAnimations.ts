// src/game/player/PlayerAnimations.ts
import * as THREE from 'three';
import type { FarmerGlbRuntimeData, ProceduralFarmerRig } from './PlayerMesh';
import { applyHeldToolSwing } from './HeldToolRig';

export type PlayerActionState = 'idle' | 'walk' | 'swing_tool' | 'water_plant';

export interface PlayerAnimationConfig {
  walkSpeed: number;
  swingDurationMs: number;
}

export const DEFAULT_PLAYER_ANIMATION: PlayerAnimationConfig = {
  walkSpeed: 6.5,
  swingDurationMs: 380,
};

export interface PlayerAnimRuntime {
  gaitPhase: number;
  breathePhase: number;
  toolSwingProgress: number;
  isSwingingTool: boolean;
}

/**
 * อัปเดตแอนิเมชันของตัวละคร GLB (man.glb / woman.glb) ทั้งแบบ Skeletal AnimationMixer และ Static GLB Bob/Sway
 */
export function updateFarmerGlbAnimation(
  glbData: FarmerGlbRuntimeData,
  toolHolder: THREE.Group,
  anim: PlayerAnimRuntime,
  params: {
    delta: number;
    isMoving: boolean;
    currentSpeed: number;
    targetRoll: number;
  }
): void {
  const { delta, isMoving, currentSpeed, targetRoll } = params;
  const { mixer, actions, wrapper, hasAnimations } = glbData;

  wrapper.rotation.z = THREE.MathUtils.lerp(
    wrapper.rotation.z,
    targetRoll,
    1 - Math.exp(-10.0 * delta)
  );

  if (hasAnimations) {
    mixer.update(delta);

    let desiredAction: 'idle' | 'walk' | 'swing' = 'idle';
    if (anim.isSwingingTool && actions.swing) {
      desiredAction = 'swing';
    } else if (isMoving && currentSpeed > 0.2) {
      desiredAction = 'walk';
    }

    if (glbData.currentAction !== desiredAction) {
      const prev = actions[glbData.currentAction];
      const next = actions[desiredAction] || actions.idle;
      if (next && prev && prev !== next) {
        prev.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
      } else if (next) {
        next.play();
      }
      glbData.currentAction = desiredAction;
    }

    if (desiredAction === 'walk' && actions.walk) {
      actions.walk.timeScale = Math.max(0.7, currentSpeed * 0.45);
    }
  } else {
    if (isMoving && currentSpeed > 0.2) {
      anim.gaitPhase += delta * (4.2 + currentSpeed * 1.6);
      const bob = Math.abs(Math.sin(anim.gaitPhase)) * 0.05;
      const sway = Math.sin(anim.gaitPhase) * 0.04;
      wrapper.position.y = bob;
      wrapper.rotation.z = targetRoll + sway;
    } else {
      wrapper.position.y = THREE.MathUtils.lerp(wrapper.position.y, 0, 0.1);
      wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, targetRoll, 0.1);
    }
  }

  if (anim.isSwingingTool) {
    anim.toolSwingProgress += delta * 6.5;
    if (anim.toolSwingProgress >= Math.PI) {
      anim.isSwingingTool = false;
      // ตัวละครที่ใช้ระบบจับจริง: คืนท่าถือเฉย ๆ / ตัวอื่น: ท่าเดิม
      if (!applyHeldToolSwing(toolHolder, 0)) toolHolder.rotation.x = Math.PI / 4;
    } else {
      const stroke = Math.sin(anim.toolSwingProgress);
      if (!applyHeldToolSwing(toolHolder, stroke)) {
        toolHolder.rotation.x = Math.PI / 4 - stroke * 1.4;
      }
    }
  }
}

/**
 * อัปเดตแอนิเมชันข้อต่อของร่าง Procedural Chibi Farmer (จังหวะก้าวเดิน หายใจ และเหวี่ยงอุปกรณ์)
 */
export function updateProceduralFarmerAnimation(
  rig: ProceduralFarmerRig,
  shadowMesh: THREE.Mesh,
  anim: PlayerAnimRuntime,
  params: {
    delta: number;
    isMoving: boolean;
    currentSpeed: number;
    targetRoll: number;
  }
): void {
  const { delta, isMoving, currentSpeed, targetRoll } = params;

  rig.pelvis.rotation.z = THREE.MathUtils.lerp(
    rig.pelvis.rotation.z,
    targetRoll,
    1 - Math.exp(-10.0 * delta)
  );

  if (isMoving && currentSpeed > 0.2) {
    const gaitFrequency = 4.2 + currentSpeed * 1.6;
    anim.gaitPhase += delta * gaitFrequency;

    const p = anim.gaitPhase;
    const legStride = Math.sin(p) * 0.72;

    rig.leftThigh.rotation.x = legStride;
    rig.leftCalf.rotation.x = legStride < 0 ? Math.sin(-legStride) * 1.1 : 0.05;
    rig.leftFoot.rotation.x = -rig.leftThigh.rotation.x * 0.3;

    rig.rightThigh.rotation.x = -legStride;
    rig.rightCalf.rotation.x = -legStride < 0 ? Math.sin(legStride) * 1.1 : 0.05;
    rig.rightFoot.rotation.x = -rig.rightThigh.rotation.x * 0.3;

    const comBounce = -Math.abs(Math.sin(p)) * 0.06;
    rig.pelvis.position.y = 0.82 + comBounce;
    rig.pelvis.rotation.y = Math.sin(p) * 0.08;

    if (!anim.isSwingingTool) {
      rig.leftUpperArm.rotation.x = -legStride * 0.75;
      rig.leftForearm.rotation.x = Math.max(0.15, -legStride * 0.4);

      rig.rightUpperArm.rotation.x = legStride * 0.75;
      rig.rightForearm.rotation.x = Math.max(0.15, legStride * 0.4);
    }

    const shadowScale = 1.0 - Math.abs(comBounce) * 1.5;
    shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
  } else {
    anim.breathePhase += delta * 2.2;
    const breathe = Math.sin(anim.breathePhase) * 0.015;

    rig.pelvis.position.y = THREE.MathUtils.lerp(rig.pelvis.position.y, 0.82, 0.1);
    rig.pelvis.rotation.set(0, 0, 0);

    rig.chest.position.y = 0.16 + breathe;
    rig.chest.scale.set(1.0 + breathe * 0.4, 1.0 + breathe * 0.4, 1.0);

    rig.leftThigh.rotation.x *= 0.82;
    rig.leftCalf.rotation.x *= 0.82;
    rig.rightThigh.rotation.x *= 0.82;
    rig.rightCalf.rotation.x *= 0.82;

    if (!anim.isSwingingTool) {
      rig.leftUpperArm.rotation.x *= 0.82;
      rig.leftForearm.rotation.x = 0.2 + breathe;

      rig.rightUpperArm.rotation.x *= 0.82;
      rig.rightForearm.rotation.x = 0.2 + breathe;
    }
  }

  if (anim.isSwingingTool) {
    anim.toolSwingProgress += delta * 6.5;
    if (anim.toolSwingProgress >= Math.PI) {
      anim.isSwingingTool = false;
      rig.rightUpperArm.rotation.x = 0;
      rig.spine.rotation.x = 0;
    } else {
      const stroke = Math.sin(anim.toolSwingProgress);
      rig.rightUpperArm.rotation.x = -stroke * 1.8;
      rig.rightForearm.rotation.x = stroke * 0.9;
      rig.spine.rotation.x = stroke * 0.22;
    }
  }
}

// src/assets/audio/soundEffects.ts
import { farmAudio } from '../../utils/audio';

export const soundEffects = {
  playPlantSound: () => farmAudio.playPlantSound(),
  playTillSound: () => farmAudio.playTillSound(),
  playWaterSound: () => farmAudio.playWaterSound(),
  playHarvestSound: () => farmAudio.playHarvestSound(),
  playCoinSound: () => farmAudio.playCoinSound(),
  playLevelUpSound: () => farmAudio.playLevelUpSound(),
  playBuildSound: () => farmAudio.playBuildSound(),
  playDoorSound: () => farmAudio.playDoorSound(),
  playHoeSound: () => farmAudio.playHoeSound(),
  playRoosterSound: () => farmAudio.playRoosterSound(),
  playBirdChirp: () => farmAudio.playBirdChirp(),
  // Animal calls
  playCowSound: () => farmAudio.playCowSound(),
  playPigSound: () => farmAudio.playPigSound(),
  playChickenSound: () => farmAudio.playChickenSound(),
  playGoatSound: () => farmAudio.playGoatSound(),
  playDogSound: () => farmAudio.playDogSound(),
  playCatSound: () => farmAudio.playCatSound(),
};

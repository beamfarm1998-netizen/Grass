// src/assets/audio/backgroundMusic.ts
import { farmAudio } from '../../utils/audio';

export const backgroundMusic = {
  startAmbiance: () => farmAudio.startAmbientMusic(),
  stopAmbiance: () => farmAudio.stopAmbiance(),
  setMusicEnabled: (enabled: boolean) => farmAudio.setMusicEnabled(enabled),
  setMuted: (muted: boolean) => farmAudio.setMuted(muted),
};

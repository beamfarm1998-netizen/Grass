import * as THREE from 'three';
import { WeatherType } from '../../core/GameConfig';

interface WeatherPresetVisuals {
  skyTopHex: number;
  skyHorizonHex: number;
  fogDensity: number;
  sunColorHex: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  windScale: number;
  rainVisible: boolean;
}

const WEATHER_PRESETS: Record<WeatherType, WeatherPresetVisuals> = {
  clear: {
    skyTopHex: 0x3b82c4,
    skyHorizonHex: 0xbbe0f2,
    fogDensity: 0.0085,
    sunColorHex: 0xfff4dc,
    sunIntensity: 2.2,
    sunPosition: [26, 36, -24],
    hemiSkyHex: 0x8fd3f4,
    hemiGroundHex: 0x2d4a3e,
    hemiIntensity: 0.85,
    windScale: 0.9,
    rainVisible: false,
  },
  sunset: {
    skyTopHex: 0x0f1a3d,
    skyHorizonHex: 0xe68a5c,
    fogDensity: 0.01,
    sunColorHex: 0xffa66b,
    sunIntensity: 2.1,
    sunPosition: [-32, 11, -36],
    hemiSkyHex: 0xc9a0dc,
    hemiGroundHex: 0x1e2238,
    hemiIntensity: 0.72,
    windScale: 0.75,
    rainVisible: false,
  },
  mist: {
    skyTopHex: 0x7c98ab,
    skyHorizonHex: 0xcfdce5,
    fogDensity: 0.022,
    sunColorHex: 0xe2ecf5,
    sunIntensity: 1.35,
    sunPosition: [18, 22, -28],
    hemiSkyHex: 0xd8e2eb,
    hemiGroundHex: 0x384b42,
    hemiIntensity: 0.95,
    windScale: 0.55,
    rainVisible: false,
  },
  rain: {
    skyTopHex: 0x334155,
    skyHorizonHex: 0x64748b,
    fogDensity: 0.0185,
    sunColorHex: 0x94a3b8,
    sunIntensity: 1.05,
    sunPosition: [12, 32, -18],
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.88,
    windScale: 1.48,
    rainVisible: true,
  },
};

export class LightingManager {
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly dockLanternLight: THREE.PointLight;
  private readonly skyMesh: THREE.Mesh;
  private readonly skyUniforms: {
    topColor: { value: THREE.Color };
    horizonColor: { value: THREE.Color };
  };
  private readonly eveningCelestialGroup = new THREE.Group();
  private readonly starUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  };
  private elapsedTime = 0;
  private readonly rainLines: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private currentWeather: WeatherType = 'clear';
  private lightningFlash = 0;
  private underwaterFactor = 0;
  private readonly baseSkyTop = new THREE.Color();
  private readonly baseSkyHorizon = new THREE.Color();
  private readonly baseHemiSky = new THREE.Color();
  private readonly baseHemiGround = new THREE.Color();
  private readonly underwaterFogColor = new THREE.Color(0x0d4554);
  private readonly underwaterDeepColor = new THREE.Color(0x072630);
  private readonly underwaterSunSky = new THREE.Color(0x38bdf8);
  private readonly flashColor = new THREE.Color(0xdbeafe);
  private readonly tempColorA = new THREE.Color();
  private readonly tempColorB = new THREE.Color();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, isSoftwareGl: boolean) {
    this.scene = scene;

    // 1. Key Light (Warm Sunlight)
    this.sunLight = new THREE.DirectionalLight(0xfff4dc, 2.2);
    this.sunLight.position.set(26, 36, -24);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 26;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    scene.add(this.sunLight);

    // 2. Cool Sky / Forest Ground Hemisphere Fill
    this.hemiLight = new THREE.HemisphereLight(0x8fd3f4, 0x2d4a3e, 0.85);
    this.hemiLight.position.set(0, 40, 0);
    scene.add(this.hemiLight);

    // 3. Subtle Rim Light separating rod, reel & fish silhouettes
    this.rimLight = new THREE.DirectionalLight(0xcbe8ff, 0.55);
    this.rimLight.position.set(-14, 14, 24);
    scene.add(this.rimLight);

    // 4. Warm Pier Lantern Accent Light
    this.dockLanternLight = new THREE.PointLight(0xffb74d, 1.4, 9.5, 2);
    this.dockLanternLight.position.set(1.38, 2.05, 14.4);
    scene.add(this.dockLanternLight);

    // 5. Procedural Gradient Sky Dome (horizon seamlessly matches FogExp2)
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3b82c4) },
      horizonColor: { value: new THREE.Color(0xbbe0f2) },
    };
    const skyGeo = new THREE.SphereGeometry(185, 28, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.58));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.skyMesh);

    // 5b. Evening Moon & Twinkling Stars over the Fishing Lake
    this.buildEveningCelestials();
    scene.add(this.eveningCelestialGroup);

    // 6. Lightweight Rain Streak System
    const dropCount = 520;
    this.rainPositions = new Float32Array(dropCount * 6);
    for (let i = 0; i < dropCount; i++) {
      const idx = i * 6;
      const rx = (Math.random() - 0.5) * 46;
      const ry = Math.random() * 18;
      const rz = -12 + (Math.random() - 0.5) * 46;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx - 0.09;
      this.rainPositions[idx + 4] = ry - 0.68;
      this.rainPositions[idx + 5] = rz;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    scene.add(this.rainLines);

    this.applyWeather('clear');
  }

  applyWeather(weather: WeatherType): number {
    this.currentWeather = weather;
    this.lightningFlash = 0;
    const preset = WEATHER_PRESETS[weather];

    this.baseSkyTop.setHex(preset.skyTopHex);
    this.baseSkyHorizon.setHex(preset.skyHorizonHex);
    this.baseHemiSky.setHex(preset.hemiSkyHex);
    this.baseHemiGround.setHex(preset.hemiGroundHex);

    this.sunLight.color.setHex(preset.sunColorHex);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.position.set(...preset.sunPosition);

    this.dockLanternLight.intensity = weather === 'sunset' || weather === 'rain' ? 2.4 : 0.9;
    this.syncAtmosphereColors();

    return preset.windScale;
  }

  setUnderwaterFactor(factor: number): void {
    const clamped = THREE.MathUtils.clamp(factor, 0, 1);
    if (Math.abs(clamped - this.underwaterFactor) < 0.002 && this.lightningFlash <= 0.001) {
      return;
    }
    this.underwaterFactor = clamped;
    this.syncAtmosphereColors();
  }

  private syncAtmosphereColors(): void {
    const preset = WEATHER_PRESETS[this.currentWeather];
    const uw = this.underwaterFactor;
    const flashBlend = this.currentWeather === 'rain' ? this.lightningFlash * 0.28 * (1 - uw) : 0;

    // Sky top & horizon blend into deep emerald-aqua when underwater
    this.tempColorA.copy(this.baseSkyTop).lerp(this.flashColor, flashBlend).lerp(this.underwaterFogColor, uw);
    this.tempColorB
      .copy(this.baseSkyHorizon)
      .lerp(this.flashColor, flashBlend * 0.75)
      .lerp(this.underwaterFogColor, uw);

    this.skyUniforms.topColor.value.copy(this.tempColorA);
    this.skyUniforms.horizonColor.value.copy(this.tempColorB);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.tempColorB);
    } else {
      this.scene.background = this.tempColorB.clone();
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.tempColorB);
      this.scene.fog.density = THREE.MathUtils.lerp(preset.fogDensity, 0.044, uw);
    }

    this.hemiLight.color.copy(this.baseHemiSky).lerp(this.underwaterSunSky, uw * 0.75);
    this.hemiLight.groundColor.copy(this.baseHemiGround).lerp(this.underwaterDeepColor, uw * 0.8);
    this.hemiLight.intensity =
      THREE.MathUtils.lerp(preset.hemiIntensity, 1.32, uw) +
      (this.currentWeather === 'rain' ? this.lightningFlash * 0.65 * (1 - uw) : 0);

    // Hide aerial rain streaks & evening stars when camera is submerged underwater
    this.rainLines.visible = preset.rainVisible && uw < 0.35;
    const showEveningSky = this.currentWeather === 'sunset' && uw < 0.25;
    this.eveningCelestialGroup.visible = showEveningSky;
    this.starUniforms.uOpacity.value = showEveningSky ? 1 - uw * 4 : 0;
  }

  private buildEveningCelestials(): void {
    // Procedural Moon + Halo
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 256;
    moonCanvas.height = 256;
    const mCtx = moonCanvas.getContext('2d')!;
    const mGrad = mCtx.createRadialGradient(112, 108, 12, 128, 128, 124);
    mGrad.addColorStop(0, '#fffdf4');
    mGrad.addColorStop(0.7, '#f5ebd2');
    mGrad.addColorStop(1, '#dfd3b8');
    mCtx.fillStyle = mGrad;
    mCtx.fillRect(0, 0, 256, 256);
    mCtx.fillStyle = 'rgba(120, 132, 156, 0.16)';
    mCtx.beginPath();
    mCtx.arc(98, 96, 34, 0, Math.PI * 2);
    mCtx.arc(148, 118, 28, 0, Math.PI * 2);
    mCtx.fill();
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.colorSpace = THREE.SRGBColorSpace;

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d')!;
    const gGrad = gCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gGrad.addColorStop(0, 'rgba(255, 250, 228, 0.85)');
    gGrad.addColorStop(0.35, 'rgba(255, 232, 188, 0.28)');
    gGrad.addColorStop(1, 'rgba(180, 210, 255, 0)');
    gCtx.fillStyle = gGrad;
    gCtx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 28, 28),
      new THREE.MeshBasicMaterial({
        map: moonTex,
        color: 0xfff8e6,
        fog: false,
        toneMapped: false,
      })
    );
    moonMesh.position.set(36, 34, -142);
    this.eveningCelestialGroup.add(moonMesh);

    const moonHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      })
    );
    moonHalo.position.copy(moonMesh.position);
    moonHalo.scale.set(28, 28, 1);
    this.eveningCelestialGroup.add(moonHalo);

    // Twinkling stars over the lake
    const count = 420;
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const size = new Float32Array(count);
    let seed = 7331;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const r = 168;
    for (let i = 0; i < count; i++) {
      const sinE = 0.1 + rand() * 0.88;
      const cosE = Math.sqrt(Math.max(0.001, 1 - sinE * sinE));
      const az = rand() * Math.PI * 2;
      pos[i * 3] = Math.sin(az) * cosE * r;
      pos[i * 3 + 1] = sinE * r;
      pos[i * 3 + 2] = -Math.cos(az) * cosE * r;
      phase[i] = rand() * Math.PI * 2;
      size[i] = 2.0 + rand() * 3.8;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    sGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const sMat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying float vTwinkle;
        varying float vElev;
        void main() {
          vTwinkle = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase);
          vElev = smoothstep(0.08, 0.28, normalize(position).y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (0.85 + 0.25 * vTwinkle);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vTwinkle;
        varying float vElev;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float a = exp(-d * d * 22.0) * vTwinkle * vElev * uOpacity;
          gl_FragColor = vec4(0.95, 0.97, 1.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const stars = new THREE.Points(sGeo, sMat);
    stars.frustumCulled = false;
    this.eveningCelestialGroup.add(stars);
    this.eveningCelestialGroup.visible = false;
  }

  triggerLightningShimmer(intensity = 0.7): void {
    if (this.currentWeather !== 'rain') return;
    this.lightningFlash = Math.min(1, 0.32 + intensity * 0.38);
  }

  getWeather(): WeatherType {
    return this.currentWeather;
  }

  update(dt: number): void {
    this.elapsedTime += dt;
    if (this.eveningCelestialGroup.visible) {
      this.starUniforms.uTime.value = this.elapsedTime;
    }
    const preset = WEATHER_PRESETS[this.currentWeather];
    if (preset.rainVisible && this.rainLines.visible) {
      const fallSpeed = 16.8 * dt;
      for (let i = 0; i < this.rainPositions.length; i += 6) {
        this.rainPositions[i + 1] -= fallSpeed;
        this.rainPositions[i + 4] -= fallSpeed;
        if (this.rainPositions[i + 4] < 0) {
          const resetY = 16 + Math.random() * 4;
          this.rainPositions[i + 1] = resetY;
          this.rainPositions[i + 4] = resetY - 0.68;
        }
      }
      (this.rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    if (this.lightningFlash > 0.001) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.6);
      this.syncAtmosphereColors();
    }
  }
}

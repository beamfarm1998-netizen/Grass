import * as THREE from 'three';
import {
  computeRendererPixelRatio,
  GRAPHICS_4K_CHANGE_EVENT,
  loadSavedGraphicsQualityMode,
  loadSavedUltra4kEnabled,
} from '../../../utils/graphics4k';
import { isMobileViewportOrTouch } from '../../../utils/glbValidator';

let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') return true;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = true;
    return true;
  }
}

export class RendererManager {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  private readonly isMobileGpu: boolean;
  private container: HTMLElement;
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;
  private graphics4kHandler: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isMobileGpu = isMobileViewportOrTouch();
    const initialMode = loadSavedGraphicsQualityMode();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && (!this.isMobileGpu || initialMode === 'ultra4k'),
      powerPreference: 'high-performance',
      alpha: false,
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && initialMode !== 'smooth';
    // PCFSoftShadowMap ถูกถอดออกจาก three แล้ว ใช้ PCFShadowMap ทุกอุปกรณ์
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.applyResolution(width, height);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
    };
    this.contextRestoredHandler = () => {
      this.applyResolution(
        Math.max(1, container.clientWidth || window.innerWidth),
        Math.max(1, container.clientHeight || window.innerHeight)
      );
    };
    this.graphics4kHandler = () => {
      this.applyResolution(
        Math.max(1, this.container.clientWidth || window.innerWidth),
        Math.max(1, this.container.clientHeight || window.innerHeight)
      );
    };

    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLostHandler, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestoredHandler, false);
    window.addEventListener(GRAPHICS_4K_CHANGE_EVENT, this.graphics4kHandler);

    container.appendChild(this.renderer.domElement);
  }

  private applyResolution(width: number, height: number): void {
    const safeW = Math.max(1, Math.floor(width));
    const safeH = Math.max(1, Math.floor(height));
    const qualityMode = loadSavedGraphicsQualityMode();
    const ultra4k = loadSavedUltra4kEnabled();
    const dpr = computeRendererPixelRatio({
      renderer: this.renderer,
      cssWidth: safeW,
      cssHeight: safeH,
      ultra4k,
      qualityMode,
      isSoftwareGl: this.isSoftwareGl,
      isMobileGpu: this.isMobileGpu,
    });
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && qualityMode !== 'smooth';
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(safeW, safeH, false);
  }

  resize(width: number, height: number): void {
    this.applyResolution(width, height);
  }

  getMaxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  dispose(): void {
    const canvas = this.renderer.domElement;
    if (this.contextLostHandler) {
      canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
    }
    if (this.contextRestoredHandler) {
      canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
    }
    if (this.graphics4kHandler) {
      window.removeEventListener(GRAPHICS_4K_CHANGE_EVENT, this.graphics4kHandler);
    }
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      // Ignore if context already lost
    }
  }
}

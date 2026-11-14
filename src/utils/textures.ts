import * as THREE from 'three';

/**
 * Procedural Canvas Texture Generators for Beam Farm 3D
 * All textures are synthesized client-side into CanvasTexture instances.
 * Guarantees zero 404s, sharp grazing-angle filtering, and correct color spaces.
 */

// Procedural Grass Texture
export function createGrassTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base lush meadow green
  ctx.fillStyle = '#689f38';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tonal patches
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const radius = 2 + Math.random() * 6;
    const tones = ['#7cb342', '#558b2f', '#8bc34a', '#4e7c27', '#639832'];
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft grass blade flecks
  ctx.strokeStyle = '#9ccc65';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 3 + Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

// Procedural Dirt Path Texture
export function createDirtPathTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm sandy earth
  ctx.fillStyle = '#bcaaa4';
  ctx.fillRect(0, 0, 512, 512);

  // Dirt specks & pebbles
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 4;
    const tones = ['#a1887f', '#8d6e63', '#d7ccc8', '#795548', '#c7b299'];
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

// Procedural Tilled Soil Texture (Plowed earth with dark furrows)
export function createSoilTexture(watered: boolean = false, renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const baseColor = watered ? '#2d1e14' : '#5d4037';
  const furrowColor = watered ? '#1a100b' : '#3e2723';
  const speckColors = watered ? ['#21150e', '#3a271c', '#150d09'] : ['#4e342e', '#6d4c41', '#8d6e63'];

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  // Furrows (ridge lines)
  const lines = 8;
  const spacing = 256 / lines;
  for (let i = 0; i < lines; i++) {
    const y = i * spacing + spacing / 2;
    ctx.fillStyle = furrowColor;
    ctx.fillRect(0, y - 3, 256, 6);
  }

  // Earth clods
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 3.5;
    ctx.fillStyle = speckColors[Math.floor(Math.random() * speckColors.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

// Procedural Wood Plank Texture
export function createWoodPlankTexture(colorBase: string = '#8d6e63', renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = colorBase;
  ctx.fillRect(0, 0, 512, 512);

  const plankHeight = 512 / 8;
  for (let i = 0; i < 8; i++) {
    const y = i * plankHeight;
    // Plank line
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const gy = y + 8 + g * 12;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(150, gy + (Math.random() - 0.5) * 6, 350, gy + (Math.random() - 0.5) * 6, 512, gy);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

// Procedural Barn Red Texture
export function createBarnRedTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  return createWoodPlankTexture('#b71c1c', renderer);
}

// Procedural Cobblestone Texture (for Well and Foundation)
export function createCobblestoneTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#616161';
  ctx.fillRect(0, 0, 256, 256);

  const stones = [
    { x: 30, y: 30, rx: 24, ry: 18 },
    { x: 80, y: 25, rx: 20, ry: 16 },
    { x: 130, y: 35, rx: 26, ry: 20 },
    { x: 190, y: 28, rx: 22, ry: 17 },
    { x: 45, y: 80, rx: 22, ry: 19 },
    { x: 105, y: 75, rx: 28, ry: 20 },
    { x: 165, y: 85, rx: 24, ry: 18 },
    { x: 220, y: 80, rx: 20, ry: 16 },
    { x: 30, y: 135, rx: 25, ry: 18 },
    { x: 90, y: 140, rx: 24, ry: 21 },
    { x: 150, y: 130, rx: 27, ry: 19 },
    { x: 210, y: 145, rx: 23, ry: 18 },
    { x: 40, y: 195, rx: 26, ry: 18 },
    { x: 100, y: 200, rx: 24, ry: 20 },
    { x: 160, y: 190, rx: 25, ry: 19 },
    { x: 220, y: 205, rx: 22, ry: 17 },
  ];

  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = 3;

  stones.forEach((s) => {
    ctx.fillStyle = ['#757575', '#9e9e9e', '#858585', '#6b7280'][Math.floor(Math.random() * 4)];
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

// Procedural Cow Texture (Holstein black & white irregular patches)
export function createCowTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Cream white base
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, 512, 512);

  // Black Holstein patches with natural organic blurs
  ctx.fillStyle = '#1c1b1a';
  const patches = [
    { x: 90, y: 110, rx: 75, ry: 55, rot: 0.3 },
    { x: 140, y: 150, rx: 60, ry: 45, rot: -0.2 },
    { x: 340, y: 120, rx: 80, ry: 60, rot: 0.5 },
    { x: 410, y: 160, rx: 50, ry: 40, rot: -0.4 },
    { x: 230, y: 320, rx: 90, ry: 70, rot: 0.1 },
    { x: 100, y: 390, rx: 65, ry: 50, rot: -0.3 },
    { x: 420, y: 360, rx: 70, ry: 60, rot: 0.6 },
  ];

  patches.forEach((p) => {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
    ctx.fill();
    // Sub-lobes to make spots organic
    ctx.beginPath();
    ctx.ellipse(p.x + p.rx * 0.4, p.y - p.ry * 0.3, p.rx * 0.45, p.ry * 0.5, p.rot + 0.4, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// Procedural Pig Texture (Soft rosy pink with subtle tonal gradient)
export function createPigTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffb4b4');
  grad.addColorStop(0.5, '#fca5a5');
  grad.addColorStop(1, '#f87171');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Soft subtle freckles & rosy flush
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 2;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// Procedural Chicken Feathers Texture (Warm cream feathers with scalloped shading)
export function createChickenTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, 256, 256);

  // Feather scallops
  ctx.strokeStyle = '#e7dfce';
  ctx.lineWidth = 1.5;
  for (let y = 10; y < 256; y += 14) {
    const offset = (Math.floor(y / 14) % 2) * 10;
    for (let x = -10 + offset; x < 266; x += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// Procedural Goat Fur Texture (Warm sand/fawn fleece)
export function createGoatTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#eae2d6');
  grad.addColorStop(0.7, '#d6c7b2');
  grad.addColorStop(1, '#bba891');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = 'rgba(141, 110, 99, 0.12)';
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}


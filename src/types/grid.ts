// src/types/grid.ts

export const GRID_CELL_SIZE = 2.0;
export const GRID_MIN_X = -25;
export const GRID_MAX_X = 25;
export const GRID_MIN_Z = -18;
export const GRID_MAX_Z = 18;

export function gridToWorld(gx: number, gz: number): { x: number; z: number } {
  return { x: gx * GRID_CELL_SIZE, z: gz * GRID_CELL_SIZE };
}

export function worldToGrid(x: number, z: number): { gx: number; gz: number } {
  return {
    gx: Math.round(x / GRID_CELL_SIZE),
    gz: Math.round(z / GRID_CELL_SIZE),
  };
}

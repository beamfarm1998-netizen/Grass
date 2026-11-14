export enum GameErrorCode {
  WEBGL_UNSUPPORTED = 'WEBGL_UNSUPPORTED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  ASSET_LOAD_FAILED = 'ASSET_LOAD_FAILED',
  ASSET_VALIDATION_FAILED = 'ASSET_VALIDATION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  DUPLICATE_LOOP = 'DUPLICATE_LOOP',
}

export class GameError extends Error {
  public readonly code: GameErrorCode;
  public readonly details?: unknown;

  constructor(code: GameErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.details = details;
  }
}

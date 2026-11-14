import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Game } from '../core/Game';

interface GameContextValue {
  game: Game;
}

const GameContext = createContext<GameContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) {
    gameRef.current = new Game();
  }

  const value = useMemo<GameContextValue>(() => ({ game: gameRef.current! }), []);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export function useGameInstance(): Game {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameInstance must be used within AppProvider');
  }
  return ctx.game;
}

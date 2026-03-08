import type { CardData } from './card';

export type GamePhase = 'IDLE' | 'LEVEL_START' | 'PLAYER_PLACING' | 'SCORING' | 'LEVEL_END';

export interface LayerSnapshot {
  index: number;
  cards: CardData[];
  weight: number;
  enhanceCardId: string | null;
}

export interface GameStateSnapshot {
  level: number;
  score: number;
  gold: number;
  handSize: number;
  scoreChances: number;
  discardChances: number;
  foundation: number;
  enhanceDecayMultiplier: number;
  scoringRoundsElapsed: number;
  prevLevelScore: number;
  prevLevelTarget: number;
}

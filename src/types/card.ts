import type { RegisteredHandler } from './events';

export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type HandType = 'single' | 'pair' | 'three_of_a_kind' | 'straight' | 'flush' | 'straight_flush';

export interface CardData {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface DetectedHand {
  type: HandType;
  cards: CardData[];
}

export interface Layer {
  pokerSlots: (CardData | null)[];
  overrideWeight?: number | null;
}

export interface CollapseResult {
  collapsed: boolean;
  triggerLayerIndex: number;
  destroyedLayerIndices: number[];
  destroyedCards: CardData[];
}

export interface EnhanceCardDef {
  id: string;
  name: string;
  description: string;
  spriteFrame: number;
  getHandlers(layerIndex: number): RegisteredHandler[];
}

export interface ChallengeCardDef {
  id: string;
  name: string;
  description: string;
  triggerEventName: string;
  spriteFrame: number;
  getHandlers(): RegisteredHandler[];
}

export interface ConsumeCardDef {
  id: string;
  name: string;
  description: string;
  requiresTarget: boolean;
  execute(ctx: ConsumeExecuteContext): void;
}

export interface ConsumeExecuteContext {
  card: ConsumeCardDef;
  targetCard?: CardData;
  targetLayerIndex?: number;
  targetSlotIndex?: number;
  sideEffects: SideEffect[];
}

export interface SideEffect {
  type: string;
  [key: string]: unknown;
}

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

export type SideEffect =
  | { type: 'MODIFY_RANDOM_CARDS'; count: number; valueChange: number; targetCard?: CardData; recalculateCollapse?: boolean }
  | { type: 'MODIFY_TOTAL_SCORE'; multiplier: number }
  | { type: 'DESTROY_RANDOM_SLOT'; layerIndex: number; count: number; recalculateCollapse?: boolean }
  | { type: 'MODIFY_GOLD'; multiplier?: number; delta: number }
  | { type: 'MODIFY_HAND_SIZE'; delta: number; trimExcess?: boolean }
  | { type: 'MODIFY_SCORE_CHANCE'; delta: number }
  | { type: 'DISCARD_RANDOM_HAND'; count: number }
  | { type: 'DESTROY_RANDOM_BOARD_CARD'; count: number; recalculateCollapse?: boolean }
  | { type: 'APPLY_ENHANCE_DECAY'; factor: number }
  | { type: 'FORCE_FAIL_LEVEL' }
  | { type: 'ADD_NEXT_SCORE_BONUS'; bonus: number }
  | { type: 'DISABLE_LAYER_SLOT'; layerIndex: number; slotIndex: number }
  | { type: 'VOID_DRAWN_CARD'; card: CardData }
  | { type: 'REPLACE_HAND_CARDS'; count: number; replaceSuit: Suit; replaceRank: Rank }
  | { type: 'TEMP_FOUNDATION_BONUS'; bonus: number }
  | { type: 'DESTROY_SPECIFIC_CARD'; layerIndex: number; slotIndex: number; skipCollapse?: boolean };

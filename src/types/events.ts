import type { CardData, DetectedHand, SideEffect } from './card';
import type { GamePhase, LayerSnapshot, GameStateSnapshot } from './game';
import type { GameEventName } from '../events/GameEvents';

export type EventHandler<T extends BaseEventContext = BaseEventContext> = (ctx: T) => void;

export interface RegisteredHandler {
  sourceId: string;
  sourceType: 'enhance' | 'challenge';
  eventName: GameEventName;
  handler: EventHandler<any>;
  priority: number;
}

export interface BaseEventContext {
  phase: GamePhase;
  level: number;
  board: LayerSnapshot[];
  gameState: GameStateSnapshot;
  sideEffects?: SideEffect[];
}

export interface LevelStartContext extends BaseEventContext {
  targetScore: number;
}

export interface CardPlacedContext extends BaseEventContext {
  card: CardData;
  layerIndex: number;
  slotIndex: number;
}

export interface CardDiscardedContext extends BaseEventContext {
  card: CardData;
}

export interface CardDrawnContext extends BaseEventContext {
  card: CardData;
}

export interface ConsumeCardUsedContext extends BaseEventContext {
  consumeCardId: string;
  targetCard?: CardData;
  targetLayerIndex?: number;
}

export interface EnhanceCardMovedContext extends BaseEventContext {
  enhanceCardId: string;
  fromLayerIndex: number;
  toLayerIndex: number;
}

export interface ScoreStartContext extends BaseEventContext {
  scoreChancesRemaining: number;
}

export interface ScoreLayerContext extends BaseEventContext {
  layerIndex: number;
  cards: CardData[];
  detectedHandTypes: DetectedHand[];
  baseScore: number;
  scoreMultiplier: number;
  scoreBonusFlat: number;
  overrideLayerWeight: number | null;
}

export interface ScoreEndContext extends BaseEventContext {
  totalScoreGained: number;
}

export interface LevelEndContext extends BaseEventContext {
  finalScore: number;
  targetScore: number;
  survived: boolean;
  foundationValue: number;
}

export interface CollapseTriggeredContext extends BaseEventContext {
  triggerLayerIndex: number;
  destroyedLayerIndices: number[];
  destroyedCards: CardData[];
}

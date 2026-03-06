import type { CardData, DetectedHand, SideEffect } from './card';
import type { GamePhase, LayerSnapshot, GameStateSnapshot } from './game';
import type { GameEventName } from '../events/GameEvents';

/** 单层计分结果（含 hands 用于动画，overrideLayerWeight 用于物理更新） */
export interface LayerScoreResult {
  layerIndex: number;
  cards: CardData[];
  hands: DetectedHand[];
  baseScore: number;
  scoreMultiplier: number;
  scoreBonusFlat: number;
  layerScore: number;
  overrideLayerWeight: number | null;
}

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
  /** 基础分（可被handler修改，如HourglassTax、MirrorWorld） */
  baseScore: number;
  scoreMultiplier: number;
  scoreBonusFlat: number;
  overrideLayerWeight: number | null;
  /** 已完成计分的层结果（用于共鸣破坏、镜像增幅等跨层协同） */
  previousLayerResults: LayerScoreResult[];
}

export interface ScoreEndContext extends BaseEventContext {
  totalScoreGained: number;
  /** 当前关卡目标分（GravityAccel等条件惩罚需要） */
  targetScore: number;
  /** 当前关卡已累积总分（不含本次） */
  levelScoreBefore: number;
  /** 各层计分结果，Symbiosis等卡用于读取最低层得分 */
  layerResults: LayerScoreResult[];
  /** 本次计分后可追加的奖励分（Symbiosis填充，BattleScene在SCORE_END后加入总分） */
  postLayerBonus: number;
  /** 本次计分获得的金币（GreedCurse可修改此值） */
  goldEarned: number;
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

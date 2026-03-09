import type { CardData, EnhanceCardDef, ConsumeCardDef } from '../types/card';
import {
  DEFAULT_HAND_SIZE,
  PLAY_CARDS_LIMIT,
  DISCARD_CHANCES_PER_ROUND,
  DISCARD_CARDS_LIMIT,
} from '../config';

export interface PlayerBuildModifiers {
  handSizeDelta: number;
  playsPerRoundDelta: number;
  discardChancesDelta: number;
  discardCountDelta: number;
}

/** 玩家构建纯数据定义，可序列化，跨关卡持久 */
export interface PlayerBuild {
  baseHandSize: number;
  basePlaysPerRound: number;
  baseDiscardChancesPerRound: number;
  baseDiscardCountPerAction: number;
  enhanceSlotCount: number;
  activeEnhanceCards: (EnhanceCardDef | null)[];
  enhanceInventory: EnhanceCardDef[];
  consumeInventory: ConsumeCardDef[];
  activeConsumeSlots: (ConsumeCardDef | null)[];
  deck: CardData[];
}

export function createDefaultPlayerBuild(): PlayerBuild {
  return {
    baseHandSize: DEFAULT_HAND_SIZE,
    basePlaysPerRound: PLAY_CARDS_LIMIT,
    baseDiscardChancesPerRound: DISCARD_CHANCES_PER_ROUND,
    baseDiscardCountPerAction: DISCARD_CARDS_LIMIT,
    enhanceSlotCount: 4,
    activeEnhanceCards: [null, null, null, null],
    enhanceInventory: [],
    consumeInventory: [],
    activeConsumeSlots: [null, null],
    deck: [],
  };
}

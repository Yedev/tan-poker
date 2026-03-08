import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, CardPlacedContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { getLayerWeight, getWeightAbove } from '../../logic/collapse';
import { Logger } from '../../utils/Logger';

/**
 * 薄冰警告 — ★★☆☆ Tier1
 * 若放置后棋盘总承重超过基层承重的80%，随机弃1张手牌
 */
export const ThinIce: ChallengeCardDef = {
  id: 'challenge_thin_ice',
  name: '薄冰警告',
  description: '若放置后棋盘总权重超过基层承重的80%，随机弃1张手牌',
  triggerEventName: GAME_EVENTS.CARD_PLACED,
  spriteFrame: 15,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_thin_ice',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.CARD_PLACED,
      priority: 10,
      handler(ctx: CardPlacedContext) {
        const foundation = ctx.gameState.foundation;
        if (foundation === Infinity || foundation <= 0) return;

        // Calculate total weight from board snapshot
        const totalWeight = ctx.board.reduce((sum, l) => sum + l.weight, 0);
        const threshold = foundation * 0.8;

        if (totalWeight > threshold) {
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({ type: 'DISCARD_RANDOM_HAND', count: 1 });
          Logger.handler('薄冰警告', 'challenge', 10, true,
            `放置后总重 ${totalWeight} > 阈值 ${threshold.toFixed(1)} (基层 ${foundation} × 0.8) → 随机弃1张手牌`);
        } else {
          Logger.handler('薄冰警告', 'challenge', 10, false,
            `总重 ${totalWeight} ≤ 阈值 ${threshold.toFixed(1)}，不触发`);
        }
      },
    }];
  },
};

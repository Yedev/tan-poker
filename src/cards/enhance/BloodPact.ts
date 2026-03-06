import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 血契誓约
 * 本层计分后，从手牌随机弃1张牌；但本层 mult ×2.5
 */
export const BloodPact: EnhanceCardDef = {
  id: 'enhance_blood_pact',
  name: '血契誓约',
  description: '本层乘数×2.5，但计分后随机弃1张手牌（高风险高回报）',
  spriteFrame: 10,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_blood_pact',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 1,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        if (ctx.cards.length === 0) return;

        ctx.scoreMultiplier *= 2.5;
        // Discard side effect runs after scoring via sideEffects
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({ type: 'DISCARD_RANDOM_HAND', count: 1 });
        Logger.handler('血契誓约', 'enhance', 1, true,
          `Layer${layerIndex}: mult ×2.5 = ${ctx.scoreMultiplier.toFixed(2)}，弃1张手牌`);
      },
    }];
  },
};

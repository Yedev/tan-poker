import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 金对共鸣
 * 本层含对子 → mult+1.0；含三条 → mult+2.5
 */
export const GoldenPair: EnhanceCardDef = {
  id: 'enhance_golden_pair',
  name: '金对共鸣',
  description: '本层含对子 → 乘数+1.0；含三条 → 乘数+2.5',
  spriteFrame: 4,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_golden_pair',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const hasThree = ctx.detectedHandTypes.some(h => h.type === 'three_of_a_kind');
        const hasPair = ctx.detectedHandTypes.some(h => h.type === 'pair');
        if (hasThree) {
          ctx.scoreMultiplier += 2.5;
          Logger.handler('金对共鸣', 'enhance', 0, true, `Layer${layerIndex}: 三条 → mult+2.5 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else if (hasPair) {
          ctx.scoreMultiplier += 1.0;
          Logger.handler('金对共鸣', 'enhance', 0, true, `Layer${layerIndex}: 对子 → mult+1.0 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else {
          Logger.handler('金对共鸣', 'enhance', 0, false, `Layer${layerIndex}: 无对子/三条，不触发`);
        }
      },
    }];
  },
};

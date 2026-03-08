import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 同花催化
 * 本层含同花 → mult+2.5；同花顺额外+1.0（共+3.5）
 */
export const FlushCatalyst: EnhanceCardDef = {
  id: 'enhance_flush_catalyst',
  name: '同花催化',
  description: '本层含同花 → 乘数+2.5；同花顺额外+1.0',
  spriteFrame: 9,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_flush_catalyst',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const hasStraightFlush = ctx.detectedHandTypes.some(h => h.type === 'straight_flush');
        const hasFlush = hasStraightFlush || ctx.detectedHandTypes.some(h => h.type === 'flush');

        if (hasStraightFlush) {
          ctx.scoreMultiplier += 3.5;
          Logger.handler('同花催化', 'enhance', 0, true,
            `Layer${layerIndex}: 同花顺 → mult+3.5 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else if (hasFlush) {
          ctx.scoreMultiplier += 2.5;
          Logger.handler('同花催化', 'enhance', 0, true,
            `Layer${layerIndex}: 同花 → mult+2.5 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else {
          Logger.handler('同花催化', 'enhance', 0, false, `Layer${layerIndex}: 无同花，不触发`);
        }
      },
    }];
  },
};

import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler } from '../../types/events';
import type { ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

export const StraightFever: EnhanceCardDef = {
  id: 'enhance_straight_fever',
  name: '顺子狂热',
  description: '本层含顺子时，本层计分乘区 +2.0',
  spriteFrame: 0,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_straight_fever',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const hasStraight = ctx.detectedHandTypes.some(
          h => h.type === 'straight' || h.type === 'straight_flush',
        );
        if (hasStraight) {
          ctx.scoreMultiplier += 2.0;
          Logger.handler('顺子狂热', 'enhance', 0, true, `Layer${layerIndex}: 检测到顺子 → scoreMultiplier +2.0 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else {
          Logger.handler('顺子狂热', 'enhance', 0, false, `Layer${layerIndex}: 无顺子，不触发`);
        }
      },
    }];
  },
};

import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 赌徒心态
 * 50%概率：scoreMultiplier ×3.0；50%概率：scoreMultiplier ×0.3
 */
export const Gambler: EnhanceCardDef = {
  id: 'enhance_gambler',
  name: '赌徒心态',
  description: '50%: 乘数×3.0；50%: 乘数×0.3（随机爆发）',
  spriteFrame: 6,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_gambler',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 1,  // slightly after other enhances to multiply their result
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const win = Math.random() < 0.5;
        const factor = win ? 3.0 : 0.3;
        ctx.scoreMultiplier *= factor;
        Logger.handler('赌徒心态', 'enhance', 1, true,
          `Layer${layerIndex}: ${win ? '✓ 胜' : '✗ 败'} → mult ×${factor} = ${ctx.scoreMultiplier.toFixed(2)}`);
      },
    }];
  },
};

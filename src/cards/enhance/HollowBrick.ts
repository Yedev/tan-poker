import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

export const HollowBrick: EnhanceCardDef = {
  id: 'enhance_hollow_brick',
  name: '空心砖',
  description: '本层计分牌面值翻倍，但该层在坍塌承重中视为 0',
  spriteFrame: 1,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_hollow_brick',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        ctx.scoreMultiplier *= 2.0;
        ctx.overrideLayerWeight = 0;
        Logger.handler('空心砖', 'enhance', 0, true, `Layer${layerIndex}: scoreMultiplier ×2 → ${ctx.scoreMultiplier.toFixed(1)}，承重覆盖 → 0`);
      },
    }];
  },
};

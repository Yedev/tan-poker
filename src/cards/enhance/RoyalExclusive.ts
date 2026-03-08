import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

export const RoyalExclusive: EnhanceCardDef = {
  id: 'enhance_royal_exclusive',
  name: '皇室专属',
  description: '本层每有一张 J/Q/K，本层计分 +50',
  spriteFrame: 2,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_royal_exclusive',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const royalCount = ctx.cards.filter(c => c.rank >= 11 && c.rank <= 13).length;
        if (royalCount > 0) {
          ctx.scoreBonusFlat += royalCount * 50;
          Logger.handler('皇室专属', 'enhance', 0, true, `Layer${layerIndex}: 皇室牌 ${royalCount} 张 → scoreBonusFlat +${royalCount * 50} (now ${ctx.scoreBonusFlat})`);
        } else {
          Logger.handler('皇室专属', 'enhance', 0, false, `Layer${layerIndex}: 无皇室牌，不触发`);
        }
      },
    }];
  },
};

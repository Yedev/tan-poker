import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';

export const RoyalExclusive: EnhanceCardDef = {
  id: 'enhance_royal_exclusive',
  name: '皇室专属',
  description: '本层每有一张 J/Q/K，本层计分 +50',
  spriteFrame: 2,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_royal_exclusive',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const royalCount = ctx.cards.filter(c => c.rank >= 11 && c.rank <= 13).length;
        ctx.scoreBonusFlat += royalCount * 50;
      },
    }];
  },
};

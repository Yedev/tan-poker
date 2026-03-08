import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, CardDrawnContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

export const LuckyDraw: EnhanceCardDef = {
  id: 'enhance_lucky_draw',
  name: '幸运摸牌',
  description: '每次从牌库摸到 A，本关手牌上限 +1',
  spriteFrame: 3,

  getHandlers(_layerIndex: number, rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_lucky_draw',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.CARD_DRAWN,
      priority: 0,
      handler(ctx: CardDrawnContext) {
        if (ctx.card.rank === 14) {
          rt.applyModifier('handSizeDelta', 1);
          Logger.handler('幸运摸牌', 'enhance', 0, true, `摸到A(${Logger.fmtCard(ctx.card)}) → 手牌上限 +1 (now ${rt.getEffectiveHandSize()})`);
        }
      },
    }];
  },
};

import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, CardPlacedContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { GameState } from '../../state/GameState';
import { Logger } from '../../utils/Logger';

/**
 * 点金手
 * 每放置一张A到棋盘，本次计分获得额外金币+8
 * 注：金币在BattleScene的CARD_PLACED后处理中添加
 */
export const MidasTouch: EnhanceCardDef = {
  id: 'enhance_midas_touch',
  name: '点金手',
  description: '每放置一张A到棋盘，额外获得+8金币',
  spriteFrame: 8,

  getHandlers(_layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_midas_touch',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.CARD_PLACED,
      priority: 0,
      handler(ctx: CardPlacedContext) {
        if (ctx.card.rank === 14) {  // Ace
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({ type: 'MODIFY_GOLD', delta: 8 });
          Logger.handler('点金手', 'enhance', 0, true,
            `放置A (${ctx.card.suit}) → +8 金币`);
        }
      },
    }];
  },
};

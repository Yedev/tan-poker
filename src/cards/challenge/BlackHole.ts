import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, CardDrawnContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { GameState } from '../../state/GameState';
import { Logger } from '../../utils/Logger';

/**
 * 黑洞吸积 — ★★★★ Tier3
 * 每摸到第5张牌，该牌直接进入弃牌堆（无法入手）
 * 注：吞噬逻辑由BattleScene的fillHand处理，此handler追踪计数并标记
 */
export const BlackHole: ChallengeCardDef = {
  id: 'challenge_black_hole',
  name: '黑洞吸积',
  description: '每摸到第5张牌，该牌直接进入弃牌堆（摸牌效率-20%）',
  triggerEventName: GAME_EVENTS.CARD_DRAWN,
  spriteFrame: 24,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_black_hole',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.CARD_DRAWN,
      priority: 10,
      handler(ctx: CardDrawnContext) {
        const gs = GameState.getInstance();
        gs.drawnCardCount++;

        if (gs.drawnCardCount % 5 === 0) {
          // Mark this card to be discarded — BattleScene will check sideEffects
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({
            type: 'VOID_DRAWN_CARD',
            card: ctx.card,
          });
          Logger.handler('黑洞吸积', 'challenge', 10, true,
            `第 ${gs.drawnCardCount} 张牌 [${ctx.card.suit}${ctx.card.rank}] → 被黑洞吞噬`);
        } else {
          Logger.handler('黑洞吸积', 'challenge', 10, false,
            `摸牌计数: ${gs.drawnCardCount} (下次吞噬: ${5 - (gs.drawnCardCount % 5)} 张后)`);
        }
      },
    }];
  },
};

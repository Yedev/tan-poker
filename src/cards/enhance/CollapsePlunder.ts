import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, CollapseTriggeredContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 坍塌掠夺
 * 坍塌时，被摧毁的牌中面值最高的3张，将其面值之和作为bonus加入下次计分
 */
export const CollapsePlunder: EnhanceCardDef = {
  id: 'enhance_collapse_plunder',
  name: '坍塌掠夺',
  description: '坍塌时，被摧毁最高3张牌的面值之和加入下次计分基础分',
  spriteFrame: 13,

  getHandlers(_layerIndex: number, rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_collapse_plunder',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.COLLAPSE_TRIGGERED,
      priority: 0,
      handler(ctx: CollapseTriggeredContext) {
        if (ctx.destroyedCards.length === 0) return;

        const sorted = [...ctx.destroyedCards].sort((a, b) => b.rank - a.rank);
        const top3 = sorted.slice(0, 3);
        const bonus = top3.reduce((s, c) => s + c.rank, 0);

        rt.nextScoreFlatBonus += bonus;

        Logger.handler('坍塌掠夺', 'enhance', 0, true,
          `坍塌 ${ctx.destroyedCards.length} 张 → 前3最高 [${top3.map(c => c.rank).join(',')}] = +${bonus} 下次计分加值`);
      },
    }];
  },
};

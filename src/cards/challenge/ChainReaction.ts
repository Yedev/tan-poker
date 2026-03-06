import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, CollapseTriggeredContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 连锁反应 — ★★★★ Tier3
 * 发生坍塌时，额外随机摧毁1张已放置的棋盘牌
 */
export const ChainReaction: ChallengeCardDef = {
  id: 'challenge_chain_reaction',
  name: '连锁反应',
  description: '坍塌时，额外随机摧毁1张棋盘牌（已被坍塌销毁的除外）',
  triggerEventName: GAME_EVENTS.COLLAPSE_TRIGGERED,
  spriteFrame: 22,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_chain_reaction',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.COLLAPSE_TRIGGERED,
      priority: 10,
      handler(ctx: CollapseTriggeredContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'DESTROY_RANDOM_BOARD_CARD',
          count: 1,
          recalculateCollapse: true,
        });
        Logger.handler('连锁反应', 'challenge', 10, true,
          `坍塌触发 → 额外摧毁1张棋盘牌`);
      },
    }];
  },
};

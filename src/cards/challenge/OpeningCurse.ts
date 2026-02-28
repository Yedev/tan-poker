import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, LevelStartContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

export const OpeningCurse: ChallengeCardDef = {
  id: 'challenge_opening_curse',
  name: '开局诅咒',
  description: '关卡开始时，随机摧毁底层一个已放置的槽位',
  triggerEventName: GAME_EVENTS.LEVEL_START,
  spriteFrame: 13,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_opening_curse',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 10,
      handler(ctx: LevelStartContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'DESTROY_RANDOM_SLOT',
          layerIndex: 2,
          count: 1,
          recalculateCollapse: false,
        });
        Logger.handler('开局诅咒', 'challenge', 10, true, `关卡开始 → 销毁底层(Layer2)随机 1 个槽位  目标分=${ctx.targetScore}`);
      },
    }];
  },
};

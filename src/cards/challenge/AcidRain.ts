import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';

export const AcidRain: ChallengeCardDef = {
  id: 'challenge_acid_rain',
  name: '酸雨腐蚀',
  description: '每次计分结束后，随机降低桌面 3 张牌牌面值 -2',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 10,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_acid_rain',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_RANDOM_CARDS',
          count: 3,
          valueChange: -2,
          recalculateCollapse: true,
        });
      },
    }];
  },
};

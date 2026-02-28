import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';

export const Detention: ChallengeCardDef = {
  id: 'challenge_detention',
  name: '扣留',
  description: '每次计分结束后，本关手牌上限 -1',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 12,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_detention',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_HAND_SIZE',
          delta: -1,
          trimExcess: true,
        });
      },
    }];
  },
};

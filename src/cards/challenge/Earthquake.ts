import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';

export const Earthquake: ChallengeCardDef = {
  id: 'challenge_earthquake',
  name: '强震',
  description: '每次计分结束后，当前总得分扣除 10%',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 11,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_earthquake',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_TOTAL_SCORE',
          multiplier: 0.9,
        });
      },
    }];
  },
};

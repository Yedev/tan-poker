import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 贪婪诅咒 — ★★★☆ Tier2
 * 本次计分获得金币减少50%
 */
export const GreedCurse: ChallengeCardDef = {
  id: 'challenge_greed_curse',
  name: '贪婪诅咒',
  description: '每次计分后，本次获得金币减少50%',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 17,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_greed_curse',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        const before = ctx.goldEarned;
        ctx.goldEarned = Math.floor(ctx.goldEarned * 0.5);
        Logger.handler('贪婪诅咒', 'challenge', 10, true,
          `计分结束 → 本次金币 ${before} → ${ctx.goldEarned} (×0.5)`);
      },
    }];
  },
};

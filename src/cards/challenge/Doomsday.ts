import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 末日时钟 — ★★★★★ Tier4
 * 计分结束后若总分未达目标的50%，直接判定本关失败
 */
export const Doomsday: ChallengeCardDef = {
  id: 'challenge_doomsday',
  name: '末日时钟',
  description: '每次计分后，若总分 < 目标×50%，直接判定本关失败',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 29,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_doomsday',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 20,  // last to run
      handler(ctx: ScoreEndContext) {
        const currentTotal = ctx.levelScoreBefore + ctx.totalScoreGained;
        const threshold = ctx.targetScore * 0.5;

        if (currentTotal < threshold) {
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({ type: 'FORCE_FAIL_LEVEL' });
          Logger.handler('末日时钟', 'challenge', 20, true,
            `计分后总分 ${currentTotal.toFixed(0)} < 目标50%=${threshold.toFixed(0)} → 强制失败`);
        } else {
          Logger.handler('末日时钟', 'challenge', 20, false,
            `总分 ${currentTotal.toFixed(0)} ≥ 目标50%=${threshold.toFixed(0)}，安全`);
        }
      },
    }];
  },
};

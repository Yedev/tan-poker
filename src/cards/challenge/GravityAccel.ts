import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 重力加速 — ★★★★ Tier3
 * 若本次得分 < 目标分 ÷ 剩余计分次数，总分额外 ×0.8
 */
export const GravityAccel: ChallengeCardDef = {
  id: 'challenge_gravity_accel',
  name: '重力加速',
  description: '若本次得分 < 目标分/剩余次数，总分额外 ×0.8（惩罚囤分爆发）',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 21,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_gravity_accel',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        const chancesLeft = ctx.gameState.scoreChances;
        if (chancesLeft <= 0) return;

        const required = ctx.targetScore / chancesLeft;
        if (ctx.totalScoreGained < required) {
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({ type: 'MODIFY_TOTAL_SCORE', multiplier: 0.8 });
          Logger.handler('重力加速', 'challenge', 10, true,
            `本次 ${ctx.totalScoreGained.toFixed(0)} < 需求 ${required.toFixed(0)} (目标${ctx.targetScore}/剩余${chancesLeft}) → 总分 ×0.8`);
        } else {
          Logger.handler('重力加速', 'challenge', 10, false,
            `本次 ${ctx.totalScoreGained.toFixed(0)} ≥ 需求 ${required.toFixed(0)}，不触发`);
        }
      },
    }];
  },
};

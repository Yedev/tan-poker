import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 沙漏税 — ★★☆☆ Tier1
 * 每次计分开始时，本次每层基础分 ×0.85（作用于SCORE_LAYER的baseScore）
 */
export const HourglassTax: ChallengeCardDef = {
  id: 'challenge_hourglass_tax',
  name: '沙漏税',
  description: '每次计分时，各层基础分 ×0.85（惩罚依赖基础分策略）',
  triggerEventName: GAME_EVENTS.SCORE_LAYER,
  spriteFrame: 14,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_hourglass_tax',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 5,
      handler(ctx: ScoreLayerContext) {
        const before = ctx.baseScore;
        ctx.baseScore = Math.floor(ctx.baseScore * 0.85);
        Logger.handler('沙漏税', 'challenge', 5, true, `Layer${ctx.layerIndex}: baseScore ${before} → ${ctx.baseScore} (×0.85)`);
      },
    }];
  },
};

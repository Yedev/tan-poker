import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 熵增律 — ★★★★★ Tier4
 * 每次计分后，本关所有增强卡效果系数降低10%（叠加）
 * 3次后增强效果仅剩72.9%
 */
export const EntropyLaw: ChallengeCardDef = {
  id: 'challenge_entropy_law',
  name: '熵增律',
  description: '每次计分后，增强卡全局效果系数 ×0.9（叠加，终局压力）',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 26,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_entropy_law',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({ type: 'APPLY_ENHANCE_DECAY', factor: 0.9 });
        Logger.handler('熵增律', 'challenge', 10, true,
          `计分结束 → 增强系数 ×0.9 (当前 ${ctx.gameState.enhanceDecayMultiplier.toFixed(3)})`);
      },
    }];
  },
};

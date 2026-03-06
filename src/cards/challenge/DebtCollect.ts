import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, LevelStartContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 债务催收 — ★★★★★ Tier4
 * 若上一关通关得分未超目标分的150%，本关计分机会 -1
 */
export const DebtCollect: ChallengeCardDef = {
  id: 'challenge_debt_collect',
  name: '债务催收',
  description: '若上关得分 < 上关目标×1.5，本关计分机会-1（奖励激进打法）',
  triggerEventName: GAME_EVENTS.LEVEL_START,
  spriteFrame: 28,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_debt_collect',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 10,
      handler(ctx: LevelStartContext) {
        const { prevLevelScore, prevLevelTarget } = ctx.gameState;

        // Level 1 has no previous level
        if (prevLevelTarget <= 0) {
          Logger.handler('债务催收', 'challenge', 10, false, '第一关，无上关记录，不触发');
          return;
        }

        const threshold = prevLevelTarget * 1.5;
        if (prevLevelScore < threshold) {
          if (!ctx.sideEffects) ctx.sideEffects = [];
          ctx.sideEffects.push({ type: 'MODIFY_SCORE_CHANCE', delta: -1 });
          Logger.handler('债务催收', 'challenge', 10, true,
            `上关得分 ${prevLevelScore} < 目标×1.5=${threshold.toFixed(0)} → 本关计分机会-1`);
        } else {
          Logger.handler('债务催收', 'challenge', 10, false,
            `上关得分 ${prevLevelScore} ≥ 目标×1.5=${threshold.toFixed(0)}，不触发`);
        }
      },
    }];
  },
};

import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, LevelStartContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 时间压力 — ★★★☆ Tier2
 * 关卡开始时，本关计分机会 -1（最低保留1次）
 */
export const TimePressure: ChallengeCardDef = {
  id: 'challenge_time_pressure',
  name: '时间压力',
  description: '关卡开始时，计分机会-1（最低1次）',
  triggerEventName: GAME_EVENTS.LEVEL_START,
  spriteFrame: 18,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_time_pressure',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 10,
      handler(ctx: LevelStartContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({ type: 'MODIFY_SCORE_CHANCE', delta: -1 });
        Logger.handler('时间压力', 'challenge', 10, true,
          `关卡开始 → 计分次数 -1 (当前 ${ctx.gameState.scoreChances})`);
      },
    }];
  },
};

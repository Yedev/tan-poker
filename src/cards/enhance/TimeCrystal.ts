import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 时光晶石
 * 每经过1次计分，本层mult+0.3（累积，最高+1.5）
 * 使用 gameState.scoringRoundsElapsed 追踪
 */
export const TimeCrystal: EnhanceCardDef = {
  id: 'enhance_time_crystal',
  name: '时光晶石',
  description: '每轮计分后本层乘数+0.3（累积叠加，上限+1.5）',
  spriteFrame: 11,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_time_crystal',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const rounds = ctx.gameState.scoringRoundsElapsed;
        const bonus = Math.min(1.5, rounds * 0.3);
        if (bonus > 0) {
          ctx.scoreMultiplier += bonus;
          Logger.handler('时光晶石', 'enhance', 0, true,
            `Layer${layerIndex}: 已计分 ${rounds} 轮 → mult+${bonus.toFixed(1)} (now ${ctx.scoreMultiplier.toFixed(2)})`);
        } else {
          Logger.handler('时光晶石', 'enhance', 0, false,
            `Layer${layerIndex}: 首轮，无累积加成`);
        }
      },
    }];
  },
};

import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 逆风 — ★★★★ Tier3
 * 本层 scoreBonusFlat（来自增强卡的加值）效果减半
 */
export const Headwind: ChallengeCardDef = {
  id: 'challenge_headwind',
  name: '逆风',
  description: '每层计分时，增强卡平坦加值减半',
  triggerEventName: GAME_EVENTS.SCORE_LAYER,
  spriteFrame: 23,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_headwind',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 15,  // after enhance cards have added their flat bonuses
      handler(ctx: ScoreLayerContext) {
        if (ctx.scoreBonusFlat > 0) {
          const before = ctx.scoreBonusFlat;
          ctx.scoreBonusFlat = Math.floor(ctx.scoreBonusFlat * 0.5);
          Logger.handler('逆风', 'challenge', 15, true,
            `Layer${ctx.layerIndex}: scoreBonusFlat ${before} → ${ctx.scoreBonusFlat} (减半)`);
        } else {
          Logger.handler('逆风', 'challenge', 15, false,
            `Layer${ctx.layerIndex}: scoreBonusFlat=${ctx.scoreBonusFlat}，不触发`);
        }
      },
    }];
  },
};

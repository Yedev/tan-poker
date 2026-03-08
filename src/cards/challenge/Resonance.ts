import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 共鸣破坏 — ★★★★ Tier3
 * 若本层花色与上一层花色完全相同，本层乘数 ×0.5
 */
export const Resonance: ChallengeCardDef = {
  id: 'challenge_resonance',
  name: '共鸣破坏',
  description: '若本层花色与上一层完全相同，本层乘数×0.5',
  triggerEventName: GAME_EVENTS.SCORE_LAYER,
  spriteFrame: 25,

  getHandlers(rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_resonance',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 15,
      handler(ctx: ScoreLayerContext) {
        const prevSuits = rt.lastScoredLayerSuits;

        if (prevSuits.length === 0 || ctx.cards.length === 0) {
          Logger.handler('共鸣破坏', 'challenge', 15, false,
            `Layer${ctx.layerIndex}: 无上层记录，不触发`);
          return;
        }

        const currSuits = ctx.cards.map(c => c.suit).sort().join(',');
        const prevSuitsStr = [...prevSuits].sort().join(',');

        if (currSuits === prevSuitsStr) {
          const before = ctx.scoreMultiplier;
          ctx.scoreMultiplier *= 0.5;
          Logger.handler('共鸣破坏', 'challenge', 15, true,
            `Layer${ctx.layerIndex}: 花色相同 [${currSuits}] → mult ${before.toFixed(2)} × 0.5 = ${ctx.scoreMultiplier.toFixed(2)}`);
        } else {
          Logger.handler('共鸣破坏', 'challenge', 15, false,
            `Layer${ctx.layerIndex}: 花色不同 (curr=[${currSuits}] prev=[${prevSuitsStr}])，不触发`);
        }
      },
    }];
  },
};

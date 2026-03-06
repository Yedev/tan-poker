import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 镜像回声 — ★★★☆ Tier2
 * 若本层 scoreMultiplier > 2.0，乘数超出部分减半
 * 效果公式: if mult>2.0 → scoreMultiplier = 2.0 + (mult-2.0)*0.5
 */
export const MirrorEcho: ChallengeCardDef = {
  id: 'challenge_mirror_echo',
  name: '镜像回声',
  description: '若本层乘数>2.0，超出2.0的部分减半（软上限机制）',
  triggerEventName: GAME_EVENTS.SCORE_LAYER,
  spriteFrame: 16,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_mirror_echo',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 15,  // after enhance cards
      handler(ctx: ScoreLayerContext) {
        if (ctx.scoreMultiplier > 2.0) {
          const before = ctx.scoreMultiplier;
          ctx.scoreMultiplier = 2.0 + (ctx.scoreMultiplier - 2.0) * 0.5;
          Logger.handler('镜像回声', 'challenge', 15, true,
            `Layer${ctx.layerIndex}: mult ${before.toFixed(2)} → ${ctx.scoreMultiplier.toFixed(2)} (超出部分减半)`);
        } else {
          Logger.handler('镜像回声', 'challenge', 15, false,
            `Layer${ctx.layerIndex}: mult ${ctx.scoreMultiplier.toFixed(2)} ≤ 2.0，不触发`);
        }
      },
    }];
  },
};

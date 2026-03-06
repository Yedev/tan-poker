import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 赤裸计算
 * 本层baseScore翻倍，但scoreMultiplier固定为1.0（绕过乘数限制）
 * 克制镜像回声等限制乘数的挑战卡
 */
export const RawCalculus: EnhanceCardDef = {
  id: 'enhance_raw_calculus',
  name: '赤裸计算',
  description: '基础分翻倍，乘数强制为1.0（克制镜像回声）',
  spriteFrame: 14,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_raw_calculus',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 2,  // after all other enhances modify multiplier
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const before = ctx.baseScore;
        ctx.baseScore *= 2;
        ctx.scoreMultiplier = 1.0;
        Logger.handler('赤裸计算', 'enhance', 2, true,
          `Layer${layerIndex}: baseScore ${before} → ${ctx.baseScore} (×2)，mult强制=1.0`);
      },
    }];
  },
};

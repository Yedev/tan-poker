import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 铁壁防线
 * 本层权重 ≥ 上方所有层权重之和时，scoreMultiplier +1.5
 */
export const IronWall: EnhanceCardDef = {
  id: 'enhance_iron_wall',
  name: '铁壁防线',
  description: '本层承重 ≥ 上方所有层权重之和时，乘数+1.5',
  spriteFrame: 5,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_iron_wall',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;

        const layerSnap = ctx.board[layerIndex];
        if (!layerSnap) return;

        const layerWeight = layerSnap.weight;
        const weightAbove = ctx.board.slice(0, layerIndex).reduce((s, l) => s + l.weight, 0);

        if (layerWeight >= weightAbove && layerWeight > 0) {
          ctx.scoreMultiplier += 1.5;
          Logger.handler('铁壁防线', 'enhance', 0, true,
            `Layer${layerIndex}: weight=${layerWeight} ≥ 上方${weightAbove} → mult+1.5 (now ${ctx.scoreMultiplier.toFixed(1)})`);
        } else {
          Logger.handler('铁壁防线', 'enhance', 0, false,
            `Layer${layerIndex}: weight=${layerWeight} < 上方${weightAbove}，不触发`);
        }
      },
    }];
  },
};

import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 层间联动
 * 若相邻上/下层均有至少1张牌，本层 mult+0.5，且相邻层也各+0.25
 * 注：相邻层加成通过 ctx.previousLayerResults 修改无法回溯，
 * 所以此处仅给本层+0.5；相邻层+0.25在BattleScene的后处理中实现（通过sideEffects）
 */
export const LayerLink: EnhanceCardDef = {
  id: 'enhance_layer_link',
  name: '层间联动',
  description: '相邻层均有牌时，本层乘数+0.5；相邻层各+0.25',
  spriteFrame: 7,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_layer_link',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;

        const board = ctx.board;
        const hasAbove = layerIndex > 0 && board[layerIndex - 1]?.cards.length > 0;
        const hasBelow = layerIndex < board.length - 1 && board[layerIndex + 1]?.cards.length > 0;

        if (hasAbove && hasBelow) {
          ctx.scoreMultiplier += 0.5;
          Logger.handler('层间联动', 'enhance', 0, true,
            `Layer${layerIndex}: 上下层均有牌 → mult+0.5 (now ${ctx.scoreMultiplier.toFixed(2)})`);
        } else if (hasAbove || hasBelow) {
          // Single-sided adjacency still gives a small bonus
          ctx.scoreMultiplier += 0.25;
          Logger.handler('层间联动', 'enhance', 0, true,
            `Layer${layerIndex}: 单侧相邻有牌 → mult+0.25 (now ${ctx.scoreMultiplier.toFixed(2)})`);
        } else {
          Logger.handler('层间联动', 'enhance', 0, false,
            `Layer${layerIndex}: 无相邻层有牌，不触发`);
        }
      },
    }];
  },
};

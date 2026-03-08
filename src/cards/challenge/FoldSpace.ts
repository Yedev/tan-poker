import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, LevelStartContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 折叠空间 — ★★★☆ Tier2
 * 关卡开始时，随机禁用某一层的1个格子（模拟合并效果）
 * 注：完整折叠空间（合并相邻层）需要UI支持；此版本改为禁用槽位
 */
export const FoldSpace: ChallengeCardDef = {
  id: 'challenge_fold_space',
  name: '折叠空间',
  description: '关卡开始时，随机禁用中层(Layer1)的1个格子',
  triggerEventName: GAME_EVENTS.LEVEL_START,
  spriteFrame: 19,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_fold_space',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 10,
      handler(ctx: LevelStartContext) {
        // Randomly pick a layer (1 or 2) and disable a random slot
        const targetLayer = Math.random() < 0.5 ? 1 : 2;
        const layer = ctx.board[targetLayer];
        if (!layer) return;
        // Pick random slot index
        const slotCount = layer.cards.length || 2; // Use board snapshot count
        const slotIdx = Math.floor(Math.random() * slotCount);
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({ type: 'DISABLE_LAYER_SLOT', layerIndex: targetLayer, slotIndex: slotIdx });
        Logger.handler('折叠空间', 'challenge', 10, true,
          `关卡开始 → 禁用 Layer${targetLayer} Slot${slotIdx}`);
      },
    }];
  },
};

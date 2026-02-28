import type { ConsumeCardDef, ConsumeExecuteContext } from '../../types/card';

export const PrecisionBlast: ConsumeCardDef = {
  id: 'consume_precision_blast',
  name: '精准爆破',
  description: '摧毁目标牌，不触发坍塌',
  requiresTarget: true,

  execute(ctx: ConsumeExecuteContext) {
    if (ctx.targetLayerIndex !== undefined && ctx.targetSlotIndex !== undefined) {
      ctx.sideEffects.push({
        type: 'DESTROY_SPECIFIC_CARD',
        layerIndex: ctx.targetLayerIndex,
        slotIndex: ctx.targetSlotIndex,
        skipCollapse: true,
      });
    }
  },
};

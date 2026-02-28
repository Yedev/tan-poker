import type { ConsumeCardDef, ConsumeExecuteContext } from '../../types/card';

export const Concrete: ConsumeCardDef = {
  id: 'consume_concrete',
  name: '混凝土',
  description: '目标牌面值临时 +5',
  requiresTarget: true,

  execute(ctx: ConsumeExecuteContext) {
    if (ctx.targetCard) {
      ctx.sideEffects.push({
        type: 'MODIFY_RANDOM_CARDS',
        count: 0,
        valueChange: 5,
        targetCard: ctx.targetCard,
        recalculateCollapse: true,
      });
    }
  },
};

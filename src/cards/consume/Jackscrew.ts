import type { ConsumeCardDef, ConsumeExecuteContext } from '../../types/card';

export const Jackscrew: ConsumeCardDef = {
  id: 'consume_jackscrew',
  name: '千斤顶',
  description: '本次计分基层承重临时 +20',
  requiresTarget: false,

  execute(ctx: ConsumeExecuteContext) {
    ctx.sideEffects.push({
      type: 'TEMP_FOUNDATION_BONUS',
      bonus: 20,
    });
  },
};

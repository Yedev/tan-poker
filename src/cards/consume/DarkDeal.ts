import type { ConsumeCardDef, ConsumeExecuteContext } from '../../types/card';

export const DarkDeal: ConsumeCardDef = {
  id: 'consume_dark_deal',
  name: '暗箱操作',
  description: '将选中两张手牌替换为黑桃A',
  requiresTarget: false,

  execute(ctx: ConsumeExecuteContext) {
    ctx.sideEffects.push({
      type: 'REPLACE_HAND_CARDS',
      count: 2,
      replaceSuit: 'spades',
      replaceRank: 14,
    });
  },
};

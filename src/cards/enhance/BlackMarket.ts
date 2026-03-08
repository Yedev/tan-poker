import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, LevelStartContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { PlayerProfile } from '../../state/PlayerProfile';
import { Logger } from '../../utils/Logger';

/**
 * 黑市折扣
 * 每关开始时，商店随机1张增强卡折扣50%
 * 折扣信息存储在 GameState 供 ShopScene 读取
 */
export const BlackMarket: EnhanceCardDef = {
  id: 'enhance_black_market',
  name: '黑市折扣',
  description: '每关开始时，商店中随机1张增强卡折扣50%',
  spriteFrame: 16,

  getHandlers(_layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_black_market',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 0,
      handler(_ctx: LevelStartContext) {
        // Flag for ShopScene to apply discount to one random item
        PlayerProfile.getInstance().blackMarketDiscount = true;
        Logger.handler('黑市折扣', 'enhance', 0, true,
          `关卡开始 → 商店将有1张折扣50%的增强卡`);
      },
    }];
  },
};

import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 共生契约
 * 所有层计分结束后，将各层layerScore最低值作为bonus均分给其他各层
 * 弱层补强强层，消除明显的得分短板
 */
export const Symbiosis: EnhanceCardDef = {
  id: 'enhance_symbiosis',
  name: '共生契约',
  description: '所有层计分后，最低分层的得分均分给其他层（均衡加成）',
  spriteFrame: 15,

  getHandlers(_layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_symbiosis',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 0,
      handler(ctx: ScoreEndContext) {
        const results = ctx.layerResults;
        if (results.length < 2) return;

        const minScore = Math.min(...results.map(r => r.layerScore));
        const otherCount = results.length - 1;
        const bonusEach = Math.floor(minScore / otherCount);

        if (bonusEach > 0) {
          ctx.postLayerBonus += bonusEach * otherCount;
          Logger.handler('共生契约', 'enhance', 0, true,
            `最低层分 ${minScore} → 均分 ${bonusEach}/层 × ${otherCount}层 = +${bonusEach * otherCount} 总奖励`);
        } else {
          Logger.handler('共生契约', 'enhance', 0, false,
            `最低层分 ${minScore} 过低，无有效均分`);
        }
      },
    }];
  },
};

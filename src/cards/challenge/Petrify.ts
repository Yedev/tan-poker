import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreEndContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 石化凝固 — ★★★☆ Tier2
 * 每次计分后，本次计分中分数最高的层，其所有牌下一轮无法移走（石化）
 */
export const Petrify: ChallengeCardDef = {
  id: 'challenge_petrify',
  name: '石化凝固',
  description: '计分后，本次最高分层的牌下一轮无法移走',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 20,

  getHandlers(rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_petrify',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.layerResults || ctx.layerResults.length === 0) return;

        // Find highest scoring layer
        let maxScore = -1;
        let maxLayer = -1;
        for (const r of ctx.layerResults) {
          if (r.layerScore > maxScore) {
            maxScore = r.layerScore;
            maxLayer = r.layerIndex;
          }
        }
        if (maxLayer < 0) return;

        const highestResult = ctx.layerResults.find(r => r.layerIndex === maxLayer);
        if (!highestResult) return;

        // Petrify all cards in the highest layer
        const petrifiedCount = highestResult.cards.length;
        // We don't know exact slot positions from results, so we store layer-level petrify
        // BattleScene will handle the visual & interaction blocking
        rt.petrifiedSlots.add(`layer_${maxLayer}`);

        Logger.handler('石化凝固', 'challenge', 10, true,
          `计分结束 → 最高分层 Layer${maxLayer}(${maxScore.toFixed(0)}分) 石化 ${petrifiedCount} 张牌`);
      },
    }];
  },
};

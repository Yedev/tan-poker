import type { ChallengeCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { detectHandType, calculateBaseScore } from '../../logic/scoring';
import type { CardData, Rank } from '../../types/card';
import { Logger } from '../../utils/Logger';

/**
 * 镜中镜 — ★★★★★ Tier4
 * 计分时，本层牌面值顺序翻转（最大→最小，最小→最大），再参与计算
 * A变成最低，2变成最高
 */
export const MirrorWorld: ChallengeCardDef = {
  id: 'challenge_mirror_world',
  name: '镜中镜',
  description: '计分时，本层牌面值翻转（A→最小，2→最大），再计算基础分',
  triggerEventName: GAME_EVENTS.SCORE_LAYER,
  spriteFrame: 27,

  getHandlers(_rt): RegisteredHandler[] {
    return [{
      sourceId: 'challenge_mirror_world',
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 5,  // Before other enhance card calculations
      handler(ctx: ScoreLayerContext) {
        if (ctx.cards.length === 0) return;

        // Sort original ranks ascending
        const sortedRanks = [...ctx.cards].map(c => c.rank).sort((a, b) => a - b);
        // Reverse the sorted array
        const reversedRanks = [...sortedRanks].reverse();

        // Create mirrored cards with reversed ranks
        const mirroredCards: CardData[] = ctx.cards.map((c, i) => ({
          ...c,
          rank: reversedRanks[i] as Rank,
        }));

        // Recalculate base score with mirrored cards
        const mirroredHands = detectHandType(mirroredCards);
        const mirroredBaseScore = calculateBaseScore(mirroredHands);

        const before = ctx.baseScore;
        ctx.baseScore = mirroredBaseScore;
        // Also update detectedHandTypes for accurate display
        ctx.detectedHandTypes = mirroredHands;

        Logger.handler('镜中镜', 'challenge', 5, true,
          `Layer${ctx.layerIndex}: 原 ranks [${sortedRanks.join(',')}] → 镜像 [${reversedRanks.join(',')}]  baseScore ${before} → ${mirroredBaseScore}`);
      },
    }];
  },
};

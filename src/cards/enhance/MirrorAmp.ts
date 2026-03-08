import type { EnhanceCardDef } from '../../types/card';
import type { RegisteredHandler, ScoreLayerContext } from '../../types/events';
import { GAME_EVENTS } from '../../events/GameEvents';
import { Logger } from '../../utils/Logger';

/**
 * 镜像增幅
 * 本层scoreMultiplier额外 + 相邻层scoreBonusFlat / 100（四舍五入）
 * 读取 previousLayerResults 中相邻层的scoreBonusFlat
 */
export const MirrorAmp: EnhanceCardDef = {
  id: 'enhance_mirror_amp',
  name: '镜像增幅',
  description: '本层乘数 + 相邻层加值/100（协同皇室专属等加值型增强）',
  spriteFrame: 12,

  getHandlers(layerIndex: number, _rt): RegisteredHandler[] {
    return [{
      sourceId: 'enhance_mirror_amp',
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 1,  // after initial enhance cards set their bonuses
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;

        // Look for adjacent layers in previousLayerResults
        const prevResults = ctx.previousLayerResults;
        let totalFlat = 0;

        for (const r of prevResults) {
          if (Math.abs(r.layerIndex - layerIndex) === 1) {
            totalFlat += r.scoreBonusFlat;
          }
        }

        // Also check current board for next layer (not yet scored) — skip, only prev
        if (totalFlat > 0) {
          const bonus = Math.round(totalFlat / 100);
          if (bonus > 0) {
            ctx.scoreMultiplier += bonus;
            Logger.handler('镜像增幅', 'enhance', 1, true,
              `Layer${layerIndex}: 相邻层总加值${totalFlat} / 100 → mult+${bonus} (now ${ctx.scoreMultiplier.toFixed(2)})`);
          } else {
            Logger.handler('镜像增幅', 'enhance', 1, false,
              `Layer${layerIndex}: 相邻层加值${totalFlat} / 100 < 1，无效`);
          }
        } else {
          Logger.handler('镜像增幅', 'enhance', 1, false,
            `Layer${layerIndex}: 无已计分相邻层加值，不触发`);
        }
      },
    }];
  },
};

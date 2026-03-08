import type { CardData, Layer } from '../types/card';
import type { BaseEventContext, ScoreLayerContext, LayerScoreResult } from '../types/events';
import type { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { detectHandType, calculateBaseScore, HAND_TYPE_LABELS } from './scoring';
import { Logger } from '../utils/Logger';
import { SCORE_MULTIPLIER_CAP } from '../config';

export interface RoundScoreResult {
  layerResults: LayerScoreResult[];
  totalGained: number;
  plunderBonus: number;
  goldEarned: number;
  /** Suits of cards in the last scored layer (for cross-round effects) */
  lastScoredLayerSuits: string[];
}

/**
 * Score all board layers, emitting SCORE_LAYER events to allow card handlers to
 * modify multipliers and bonuses. Applies enhance decay and the global multiplier cap.
 *
 * NOTE: mutates board[i].overrideWeight when a handler sets overrideLayerWeight.
 */
export function scoreAllLayers(
  board: Layer[],
  enhanceDecayMultiplier: number,
  baseCtx: BaseEventContext,
  eventSystem: GameEventSystem,
): LayerScoreResult[] {
  const results: LayerScoreResult[] = [];

  for (let li = 0; li < board.length; li++) {
    const cards = board[li].pokerSlots.filter(Boolean) as CardData[];
    if (cards.length === 0) {
      Logger.score(`Layer${li}: 空层，跳过`);
      continue;
    }

    const hands = detectHandType(cards);
    const baseScore = calculateBaseScore(hands);
    const handNames = hands.map(h => HAND_TYPE_LABELS[h.type] || h.type).join('+');
    Logger.score(`Layer${li}: [${Logger.fmtCards(cards)}]  手型=${handNames}  基础分=${baseScore}`);

    const layerCtx: ScoreLayerContext = {
      ...baseCtx,
      layerIndex: li,
      cards,
      detectedHandTypes: hands,
      baseScore,
      scoreMultiplier: 1.0,
      scoreBonusFlat: 0,
      overrideLayerWeight: null,
      previousLayerResults: [...results],
    };
    eventSystem.emit(GAME_EVENTS.SCORE_LAYER, layerCtx);

    if (layerCtx.overrideLayerWeight !== null) {
      board[li].overrideWeight = layerCtx.overrideLayerWeight;
      Logger.score(`  Layer${li}: 承重覆盖 → ${layerCtx.overrideLayerWeight}`);
    }

    const decayedMultiplier = layerCtx.scoreMultiplier > 1.0
      ? 1.0 + (layerCtx.scoreMultiplier - 1.0) * enhanceDecayMultiplier
      : layerCtx.scoreMultiplier;
    const decayedFlat = Math.floor(layerCtx.scoreBonusFlat * enhanceDecayMultiplier);
    const cappedMultiplier = Math.min(decayedMultiplier, SCORE_MULTIPLIER_CAP);

    const layerScore = Math.floor(layerCtx.baseScore * cappedMultiplier) + decayedFlat;
    Logger.score(
      `  Layer${li}: base=${layerCtx.baseScore.toFixed(1)} × mult=${cappedMultiplier.toFixed(2)}` +
      ` + flat=${decayedFlat} = ${layerScore}` +
      (enhanceDecayMultiplier < 1.0 ? ` (衰减×${enhanceDecayMultiplier.toFixed(2)})` : ''),
    );

    results.push({
      layerIndex: li,
      cards,
      hands,
      baseScore: layerCtx.baseScore,
      scoreMultiplier: cappedMultiplier,
      scoreBonusFlat: decayedFlat,
      layerScore,
      overrideLayerWeight: layerCtx.overrideLayerWeight,
    });
  }

  return results;
}

/**
 * Aggregate a scoring round: sum layer scores, add plunder bonus, derive gold.
 * Gold formula: floor(totalGained / 10).
 */
export function computeRoundScore(
  layerResults: LayerScoreResult[],
  plunderBonus: number,
): { totalGained: number; goldEarned: number } {
  const layerTotal = layerResults.reduce((sum, r) => sum + r.layerScore, 0);
  const totalGained = layerTotal + plunderBonus;
  const goldEarned = Math.floor(totalGained / 10);
  return { totalGained, goldEarned };
}

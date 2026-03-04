import type { CardData, Layer, CollapseResult, Suit, Rank, DetectedHand } from '../types/card';
import type { SideEffect } from '../types/card';
import type { BaseEventContext, ScoreLayerContext } from '../types/events';
import { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { GameState } from '../state/GameState';
import { shuffle, draw } from './deck';
import { detectHandType, calculateBaseScore } from './scoring';
import { checkCollapse } from './collapse';
import { Logger } from '../utils/Logger';

export interface LayerScoreResult {
  layerIndex: number;
  cards: CardData[];
  hands: DetectedHand[];
  baseScore: number;
  scoreMultiplier: number;
  scoreBonusFlat: number;
  layerScore: number;
  overrideLayerWeight: number | null;
}

export type EffectDelta =
  | { type: 'CARD_RANK_CHANGED'; layerIndex: number; slotIndex: number; suit: Suit; newRank: Rank }
  | { type: 'SLOT_CLEARED'; layerIndex: number; slotIndex: number }
  | { type: 'SCORE_CHANGED'; newScore: number }
  | { type: 'HAND_TRIMMED'; newCount: number }
  | { type: 'WEIGHT_UPDATE' }
  | { type: 'COLLAPSE_CHECK' };

export class GameEngine {
  readonly board: Layer[] = [];
  readonly hand: CardData[] = [];
  readonly drawPile: CardData[] = [];
  readonly discardPile: CardData[] = [];
  levelScore = 0;
  scoreChances: number;
  discardChances: number;

  constructor(scoreChances: number, discardChances: number) {
    this.scoreChances = scoreChances;
    this.discardChances = discardChances;
  }

  initBoard(layerSlotCounts: number[]): void {
    this.board.length = 0;
    for (const count of layerSlotCounts) {
      this.board.push({ pokerSlots: new Array(count).fill(null) });
    }
  }

  initDeck(deck: CardData[]): void {
    this.drawPile.length = 0;
    this.drawPile.push(...shuffle([...deck]));
    this.discardPile.length = 0;
    this.hand.length = 0;
    Logger.deck(`牌库初始化  总牌数: ${this.drawPile.length}  [${Logger.fmtCards(this.drawPile)}]`);
  }

  fillHand(handSize: number): CardData[] {
    const need = handSize - this.hand.length;
    if (need <= 0) return [];
    Logger.card('补手牌', `需要 ${need} 张 (手牌上限 ${handSize}，当前 ${this.hand.length})`);
    const drawn = this._drawCards(need);
    this.hand.push(...drawn);
    return drawn;
  }

  discardFromHand(cards: CardData[]): void {
    for (const card of cards) {
      const idx = this.hand.indexOf(card);
      if (idx >= 0) this.hand.splice(idx, 1);
      this.discardPile.push(card);
    }
  }

  placeCard(cardData: CardData, layerIndex: number, slotIndex: number): CollapseResult | null {
    this.board[layerIndex].pokerSlots[slotIndex] = cardData;
    const idx = this.hand.indexOf(cardData);
    if (idx >= 0) this.hand.splice(idx, 1);
    return this.checkAndPerformCollapse();
  }

  checkAndPerformCollapse(): CollapseResult | null {
    const gs = GameState.getInstance();
    const result = checkCollapse(this.board, gs.foundation + gs.tempFoundationBonus);
    if (result.collapsed) {
      for (const li of result.destroyedLayerIndices) {
        for (let si = 0; si < this.board[li].pokerSlots.length; si++) {
          const card = this.board[li].pokerSlots[si];
          if (card) this.discardPile.push(card);
          this.board[li].pokerSlots[si] = null;
        }
      }
      return result;
    }
    return null;
  }

  scoreAllLayers(baseCtx: BaseEventContext): LayerScoreResult[] {
    const ges = GameEventSystem.getInstance();
    const results: LayerScoreResult[] = [];

    for (let li = 0; li < this.board.length; li++) {
      const cards = this.board[li].pokerSlots.filter(Boolean) as CardData[];
      if (cards.length === 0) {
        Logger.score(`Layer${li}: 空层，跳过`);
        continue;
      }

      const hands = detectHandType(cards);
      const baseScore = calculateBaseScore(hands);
      const handNames = hands.map(h => {
        const labels: Record<string, string> = {
          single: '单张', pair: '对子', three_of_a_kind: '三条',
          straight: '顺子', flush: '同花', straight_flush: '同花顺',
        };
        return labels[h.type] || h.type;
      }).join('+');
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
      };
      ges.emit(GAME_EVENTS.SCORE_LAYER, layerCtx);

      if (layerCtx.overrideLayerWeight !== null) {
        this.board[li].overrideWeight = layerCtx.overrideLayerWeight;
        Logger.score(`  Layer${li}: 承重覆盖 → ${layerCtx.overrideLayerWeight}`);
      }

      const layerScore = baseScore * layerCtx.scoreMultiplier + layerCtx.scoreBonusFlat;
      Logger.score(
        `  Layer${li}: ${baseScore} × ${layerCtx.scoreMultiplier.toFixed(2)} + ${layerCtx.scoreBonusFlat} = ${layerScore.toFixed(1)}`,
      );

      results.push({
        layerIndex: li,
        cards,
        hands,
        baseScore,
        scoreMultiplier: layerCtx.scoreMultiplier,
        scoreBonusFlat: layerCtx.scoreBonusFlat,
        layerScore,
        overrideLayerWeight: layerCtx.overrideLayerWeight,
      });
    }

    return results;
  }

  applyEffects(effects: SideEffect[]): EffectDelta[] {
    const deltas: EffectDelta[] = [];
    for (const effect of effects) {
      Logger.effect(`执行副作用: ${effect.type}  参数: ${JSON.stringify(effect)}`);
      switch (effect.type) {
        case 'MODIFY_RANDOM_CARDS': {
          const count = (effect.count as number) || 1;
          const change = (effect.valueChange as number) || 0;
          Logger.effect(`MODIFY_RANDOM_CARDS: 随机修改 ${count} 张棋盘牌  rank ${change >= 0 ? '+' : ''}${change}`);
          deltas.push(...this._applyModifyCards(count, change));
          deltas.push({ type: 'WEIGHT_UPDATE' });
          if (effect.recalculateCollapse) deltas.push({ type: 'COLLAPSE_CHECK' });
          break;
        }
        case 'MODIFY_TOTAL_SCORE': {
          const mult = (effect.multiplier as number) || 1;
          const before = this.levelScore;
          this.levelScore = Math.floor(this.levelScore * mult);
          Logger.effect(`MODIFY_TOTAL_SCORE: ${before} × ${mult} → ${this.levelScore}`);
          deltas.push({ type: 'SCORE_CHANGED', newScore: this.levelScore });
          break;
        }
        case 'MODIFY_HAND_SIZE': {
          const delta = (effect.delta as number) || 0;
          const gs = GameState.getInstance();
          const before = gs.handSize;
          gs.handSize += delta;
          Logger.effect(`MODIFY_HAND_SIZE: ${before} → ${gs.handSize}  (${delta >= 0 ? '+' : ''}${delta})`);
          if (effect.trimExcess) {
            while (this.hand.length > gs.handSize && this.hand.length > 0) {
              const removed = this.hand.pop()!;
              Logger.card('手牌超限移除', Logger.fmtCard(removed));
              this.discardPile.push(removed);
            }
            deltas.push({ type: 'HAND_TRIMMED', newCount: this.hand.length });
          }
          break;
        }
        case 'DESTROY_RANDOM_SLOT': {
          const li = (effect.layerIndex as number) ?? 2;
          const cnt = (effect.count as number) || 1;
          Logger.effect(`DESTROY_RANDOM_SLOT: Layer${li} 销毁 ${cnt} 个格子`);
          deltas.push(...this._applyDestroySlots(li, cnt));
          deltas.push({ type: 'WEIGHT_UPDATE' });
          break;
        }
        default:
          Logger.warn(`未知副作用类型: ${effect.type}`);
      }
    }
    return deltas;
  }

  addScore(amount: number): void {
    this.levelScore += amount;
  }

  clearLayerOverrides(): void {
    for (const layer of this.board) {
      layer.overrideWeight = undefined;
    }
  }

  consumeScoreChance(): void {
    this.scoreChances--;
  }

  resetDiscardChances(count: number): void {
    this.discardChances = count;
  }

  private _drawCards(count: number): CardData[] {
    if (this.drawPile.length < count) {
      Logger.deck(`牌库不足 (剩 ${this.drawPile.length})，将弃牌堆 ${this.discardPile.length} 张洗入牌库`);
      this.drawPile.push(...shuffle(this.discardPile));
      this.discardPile.length = 0;
      Logger.deck(`洗牌后牌库: ${this.drawPile.length} 张`);
    }
    const drawn = draw(this.drawPile, count);
    Logger.deck(`摸牌 ${drawn.length} 张: [${Logger.fmtCards(drawn)}]  牌库剩余: ${this.drawPile.length}`);
    return drawn;
  }

  private _applyModifyCards(count: number, valueChange: number): EffectDelta[] {
    const allCards: { li: number; si: number; data: CardData }[] = [];
    for (let li = 0; li < this.board.length; li++) {
      for (let si = 0; si < this.board[li].pokerSlots.length; si++) {
        const c = this.board[li].pokerSlots[si];
        if (c) allCards.push({ li, si, data: c });
      }
    }
    const shuffled = shuffle(allCards).slice(0, count);
    const deltas: EffectDelta[] = [];
    for (const entry of shuffled) {
      const oldRank = entry.data.rank;
      const newRank = Math.max(2, Math.min(14, entry.data.rank + valueChange)) as Rank;
      entry.data.rank = newRank;
      Logger.effect(`  修改 Layer${entry.li}-Slot${entry.si}: ${Logger.fmtCard({ suit: entry.data.suit, rank: oldRank })} → rank ${newRank}`);
      deltas.push({ type: 'CARD_RANK_CHANGED', layerIndex: entry.li, slotIndex: entry.si, suit: entry.data.suit, newRank });
    }
    return deltas;
  }

  private _applyDestroySlots(layerIndex: number, count: number): EffectDelta[] {
    const occupied: number[] = [];
    for (let si = 0; si < this.board[layerIndex].pokerSlots.length; si++) {
      if (this.board[layerIndex].pokerSlots[si]) occupied.push(si);
    }
    const toDestroy = shuffle(occupied).slice(0, count);
    Logger.effect(`DESTROY_RANDOM_SLOT Layer${layerIndex}: 销毁格子 [${toDestroy.map(si => `Slot${si}`).join(', ')}]`);
    const deltas: EffectDelta[] = [];
    for (const si of toDestroy) {
      const card = this.board[layerIndex].pokerSlots[si];
      if (card) {
        Logger.card('销毁', `${Logger.fmtCard(card)} (Layer${layerIndex}-Slot${si})`);
        this.discardPile.push(card);
        this.board[layerIndex].pokerSlots[si] = null;
      }
      deltas.push({ type: 'SLOT_CLEARED', layerIndex, slotIndex: si });
    }
    return deltas;
  }
}

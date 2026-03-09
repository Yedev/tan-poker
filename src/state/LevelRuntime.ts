import type { CardData, Layer, CollapseResult, Suit, Rank, ChallengeCardDef } from '../types/card';
import type { SideEffect } from '../types/card';
import type { BaseEventContext, LayerScoreResult } from '../types/events';
import type { LevelConfig } from '../config/levels';
import type { PlayerBuildModifiers } from './PlayerBuild';
import type { GameEventSystem } from '../events/GameEventSystem';
import { PlayerProfile } from './PlayerProfile';
import { shuffle, draw } from '../logic/deck';
import { scoreAllLayers as engineScoreAllLayers } from '../logic/ScoreEngine';
import { checkCollapse } from '../logic/collapse';
import { Logger } from '../utils/Logger';
import { HAND_SIZE_CAP, ENHANCE_DECAY_FLOOR } from '../config';

/** 纯视觉 delta：只描述"画面上需要什么变化"，不含任何游戏状态指令 */
export type VisualDelta =
  | { type: 'CARD_RANK_CHANGED'; layerIndex: number; slotIndex: number; suit: Suit; newRank: Rank }
  | { type: 'SLOT_CLEARED'; layerIndex: number; slotIndex: number }
  | { type: 'HAND_TRIMMED'; newCount: number }
  | { type: 'WEIGHT_UPDATE' }
  | { type: 'ENHANCE_DECAYED'; multiplier: number }
  | { type: 'HAND_CARD_DISCARDED'; count: number };

export interface ApplyEffectsResult {
  visuals: VisualDelta[];
  /** 副作用触发的坍塌结果，由调用方负责执行动画 */
  collapseResult?: CollapseResult;
}

export interface LevelResult {
  survived: boolean;
  bonusGold: number;
  isVictory: boolean;
  foundationValue: number;
}

export class LevelRuntime {
  // ── 关卡配置 ──────────────────────────────────────────────────────────────
  readonly levelConfig: LevelConfig;
  readonly challengeCards: ChallengeCardDef[];

  // ── 棋盘/卡牌状态（原 GameEngine）────────────────────────────────────────
  readonly board: Layer[] = [];
  readonly hand: CardData[] = [];
  readonly drawPile: CardData[] = [];
  readonly discardPile: CardData[] = [];
  levelScore = 0;
  scoreChances: number;
  cardsPlayedThisRound = 0;

  // ── 关卡临时状态（原 GameState.resetLevelState 管理的字段）──────────────
  enhanceDecayMultiplier = 1.0;
  tempFoundationBonus = 0;
  drawnCardCount = 0;
  nextScoreFlatBonus = 0;
  petrifiedSlots: Set<string> = new Set();
  disabledSlots: Set<string> = new Set();
  levelForceFailed = false;
  lastScoredLayerSuits: string[] = [];
  scoringRoundsElapsed = 0;

  // ── 运行时能力修饰 ────────────────────────────────────────────────────────
  private modifiers: PlayerBuildModifiers;
  currentDiscardChances: number;

  // ── 显式持有 PlayerProfile（不再内部调用 getInstance()）──────────────────
  private readonly profile: PlayerProfile;

  private constructor(
    config: LevelConfig,
    challengeCards: ChallengeCardDef[],
    profile: PlayerProfile,
  ) {
    this.levelConfig = config;
    this.challengeCards = challengeCards;
    this.scoreChances = config.scoreChances;
    this.modifiers = { handSizeDelta: 0, playsPerRoundDelta: 0, discardChancesDelta: 0, discardCountDelta: 0 };
    this.profile = profile;
    this.currentDiscardChances = profile.playerBuild.baseDiscardChancesPerRound;
  }

  // ── 工厂方法 ───────────────────────────────────────────────────────────────

  static create(
    config: LevelConfig,
    challengeCards: ChallengeCardDef[],
    profile: PlayerProfile,
  ): LevelRuntime {
    return new LevelRuntime(config, challengeCards, profile);
  }

  // ── 运行时修饰方法（原 PlayerAbility 方法）────────────────────────────────

  resetModifiers(): void {
    this.modifiers = { handSizeDelta: 0, playsPerRoundDelta: 0, discardChancesDelta: 0, discardCountDelta: 0 };
    this.currentDiscardChances = this.getEffectiveDiscardChancesPerRound();
  }

  applyModifier(key: keyof PlayerBuildModifiers, delta: number): void {
    this.modifiers[key] += delta;
  }

  /** 手牌上限 = 玩家构建基础值 + 增强修饰 */
  getEffectiveHandSize(): number {
    return this.profile.playerBuild.baseHandSize + this.modifiers.handSizeDelta;
  }

  getEffectivePlaysPerRound(): number {
    return this.profile.playerBuild.basePlaysPerRound + this.modifiers.playsPerRoundDelta;
  }

  getEffectiveDiscardChancesPerRound(): number {
    return this.profile.playerBuild.baseDiscardChancesPerRound + this.modifiers.discardChancesDelta;
  }

  getEffectiveDiscardCount(): number {
    return this.profile.playerBuild.baseDiscardCountPerAction + this.modifiers.discardCountDelta;
  }

  // ── 棋盘/牌堆方法（原 GameEngine 方法）────────────────────────────────────

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

  /**
   * 原子化弃牌：验证弃牌次数和数量后执行，返回结果。
   * 调用方无需再手动修改 currentDiscardChances 或调用 discardFromHand。
   */
  tryDiscard(cards: CardData[]): { success: boolean; reason?: 'no_chances' | 'exceeds_limit' } {
    if (this.currentDiscardChances <= 0) return { success: false, reason: 'no_chances' };
    const limit = this.getEffectiveDiscardCount();
    if (cards.length > limit) return { success: false, reason: 'exceeds_limit' };
    this.currentDiscardChances--;
    this.discardFromHand(cards);
    return { success: true };
  }

  placeCard(cardData: CardData, layerIndex: number, slotIndex: number): CollapseResult | null {
    this.cardsPlayedThisRound++;
    this.board[layerIndex].pokerSlots[slotIndex] = cardData;
    const idx = this.hand.indexOf(cardData);
    if (idx >= 0) this.hand.splice(idx, 1);
    return this.checkAndPerformCollapse();
  }

  checkAndPerformCollapse(): CollapseResult | null {
    const result = checkCollapse(this.board, this.profile.foundation + this.tempFoundationBonus);
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

  scoreAllLayers(baseCtx: BaseEventContext, eventSystem: GameEventSystem): LayerScoreResult[] {
    const results = engineScoreAllLayers(this.board, this.enhanceDecayMultiplier, baseCtx, eventSystem);
    if (results.length > 0) {
      this.lastScoredLayerSuits = results[results.length - 1].cards.map(c => c.suit);
    }
    return results;
  }

  /**
   * 一次性应用本轮计分结果：累加得分、金币、递增计分轮次、消耗计分机会、清除层覆盖。
   * 须在 SCORE_END 事件 handler（可能修改 goldEarned/postBonus）执行后调用。
   */
  applyRoundScore(totalGained: number, postBonus: number, goldEarned: number): void {
    this.addScore(totalGained);
    if (postBonus > 0) this.addScore(postBonus);
    if (goldEarned > 0) this.profile.gold += goldEarned;
    this.scoringRoundsElapsed++;
    this.consumeScoreChance();
    this.clearLayerOverrides();
  }

  /**
   * 判断本关是否应结束（强制失败 / 已达目标分 / 计分机会耗尽）。
   * 须在 applyRoundScore 之后调用。
   */
  shouldEndLevel(targetScore: number): boolean {
    return this.levelForceFailed || this.levelScore >= targetScore || this.scoreChances <= 0;
  }

  /**
   * 结算关卡：计算 foundation、判定通关、更新 PlayerProfile，返回结果供 BattleScene 进行场景切换。
   * 此方法会修改 profile（score、foundation、gold、currentLevel 等）。
   */
  concludeLevel(targetScore: number): LevelResult {
    const foundationValue = this._computeFoundationValue();
    const survived = !this.levelForceFailed && this.levelScore >= targetScore;
    const bonusGold = survived ? 5 + this.profile.currentLevel * 2 : 0;

    this.profile.prevLevelScore = this.levelScore;
    this.profile.prevLevelTarget = targetScore;
    this.profile.score += this.levelScore;
    this.profile.foundation = foundationValue > 0 ? foundationValue : 1;

    if (survived) {
      this.profile.gold += bonusGold;
      this.profile.currentLevel++;
    }

    return {
      survived,
      bonusGold,
      isVictory: survived && this.profile.currentLevel > 20,
      foundationValue,
    };
  }

  applyEffects(effects: SideEffect[]): ApplyEffectsResult {
    const visuals: VisualDelta[] = [];
    let needsCollapseCheck = false;

    for (const effect of effects) {
      Logger.effect(`执行副作用: ${effect.type}  参数: ${JSON.stringify(effect)}`);
      switch (effect.type) {
        case 'MODIFY_RANDOM_CARDS': {
          Logger.effect(`MODIFY_RANDOM_CARDS: 随机修改 ${effect.count} 张棋盘牌  rank ${effect.valueChange >= 0 ? '+' : ''}${effect.valueChange}`);
          visuals.push(...this._applyModifyCards(effect.count, effect.valueChange));
          visuals.push({ type: 'WEIGHT_UPDATE' });
          if (effect.recalculateCollapse) needsCollapseCheck = true;
          break;
        }
        case 'MODIFY_TOTAL_SCORE': {
          const before = this.levelScore;
          this.levelScore = Math.floor(this.levelScore * effect.multiplier);
          Logger.effect(`MODIFY_TOTAL_SCORE: ${before} × ${effect.multiplier} → ${this.levelScore}`);
          break;
        }
        case 'MODIFY_HAND_SIZE': {
          const before = this.getEffectiveHandSize();
          this.applyModifier('handSizeDelta', effect.delta);
          const after = Math.max(1, Math.min(HAND_SIZE_CAP, this.getEffectiveHandSize()));
          Logger.effect(`MODIFY_HAND_SIZE: ${before} → ${after}  (${effect.delta >= 0 ? '+' : ''}${effect.delta})`);
          if (effect.trimExcess) {
            while (this.hand.length > after && this.hand.length > 0) {
              const removed = this.hand.pop()!;
              Logger.card('手牌超限移除', Logger.fmtCard(removed));
              this.discardPile.push(removed);
            }
            visuals.push({ type: 'HAND_TRIMMED', newCount: this.hand.length });
          }
          break;
        }
        case 'DESTROY_RANDOM_SLOT': {
          Logger.effect(`DESTROY_RANDOM_SLOT: Layer${effect.layerIndex} 销毁 ${effect.count} 个格子`);
          visuals.push(...this._applyDestroySlots(effect.layerIndex, effect.count));
          visuals.push({ type: 'WEIGHT_UPDATE' });
          if (effect.recalculateCollapse) needsCollapseCheck = true;
          break;
        }
        case 'MODIFY_GOLD': {
          const before = this.profile.gold;
          this.profile.gold = Math.max(0, Math.floor(this.profile.gold * (effect.multiplier ?? 1)) + effect.delta);
          Logger.effect(`MODIFY_GOLD: ${before} → ${this.profile.gold}`);
          break;
        }
        case 'MODIFY_SCORE_CHANCE': {
          const before = this.scoreChances;
          this.scoreChances = Math.max(1, this.scoreChances + effect.delta);
          Logger.effect(`MODIFY_SCORE_CHANCE: ${before} → ${this.scoreChances}`);
          break;
        }
        case 'DISCARD_RANDOM_HAND': {
          Logger.effect(`DISCARD_RANDOM_HAND: 随机弃 ${effect.count} 张手牌`);
          const discarded = shuffle([...this.hand]).slice(0, effect.count);
          for (const c of discarded) {
            const idx = this.hand.indexOf(c);
            if (idx >= 0) this.hand.splice(idx, 1);
            this.discardPile.push(c);
          }
          visuals.push({ type: 'HAND_CARD_DISCARDED', count: discarded.length });
          break;
        }
        case 'DESTROY_RANDOM_BOARD_CARD': {
          Logger.effect(`DESTROY_RANDOM_BOARD_CARD: 随机摧毁 ${effect.count} 张棋盘牌`);
          visuals.push(...this._applyDestroyBoardCards(effect.count));
          visuals.push({ type: 'WEIGHT_UPDATE' });
          if (effect.recalculateCollapse) needsCollapseCheck = true;
          break;
        }
        case 'APPLY_ENHANCE_DECAY': {
          this.enhanceDecayMultiplier = Math.max(ENHANCE_DECAY_FLOOR, this.enhanceDecayMultiplier * effect.factor);
          Logger.effect(`APPLY_ENHANCE_DECAY: 增强系数 → ${this.enhanceDecayMultiplier.toFixed(3)}`);
          visuals.push({ type: 'ENHANCE_DECAYED', multiplier: this.enhanceDecayMultiplier });
          break;
        }
        case 'FORCE_FAIL_LEVEL': {
          this.levelForceFailed = true;
          Logger.effect('FORCE_FAIL_LEVEL: 强制本关失败 (末日时钟)');
          break;
        }
        case 'ADD_NEXT_SCORE_BONUS': {
          this.nextScoreFlatBonus += effect.bonus;
          Logger.effect(`ADD_NEXT_SCORE_BONUS: +${effect.bonus}  (共 ${this.nextScoreFlatBonus})`);
          break;
        }
        case 'DISABLE_LAYER_SLOT': {
          this.disabledSlots.add(`${effect.layerIndex}-${effect.slotIndex}`);
          Logger.effect(`DISABLE_LAYER_SLOT: Layer${effect.layerIndex} Slot${effect.slotIndex} 禁用`);
          visuals.push({ type: 'SLOT_CLEARED', layerIndex: effect.layerIndex, slotIndex: effect.slotIndex });
          break;
        }
        case 'VOID_DRAWN_CARD': {
          const idx = this.hand.indexOf(effect.card);
          if (idx >= 0) {
            this.hand.splice(idx, 1);
            this.discardPile.push(effect.card);
            Logger.card('黑洞吞噬', Logger.fmtCard(effect.card));
          }
          break;
        }
        case 'REPLACE_HAND_CARDS':
          // handled externally if needed
          break;
        case 'TEMP_FOUNDATION_BONUS': {
          this.tempFoundationBonus += effect.bonus;
          Logger.effect(`TEMP_FOUNDATION_BONUS: +${effect.bonus}  (共 ${this.tempFoundationBonus})`);
          break;
        }
        case 'DESTROY_SPECIFIC_CARD': {
          const card = this.board[effect.layerIndex]?.pokerSlots[effect.slotIndex];
          if (card) {
            this.discardPile.push(card);
            this.board[effect.layerIndex].pokerSlots[effect.slotIndex] = null;
            Logger.card('精准爆破', `${Logger.fmtCard(card)} (Layer${effect.layerIndex}-Slot${effect.slotIndex})`);
          }
          visuals.push({ type: 'SLOT_CLEARED', layerIndex: effect.layerIndex, slotIndex: effect.slotIndex });
          visuals.push({ type: 'WEIGHT_UPDATE' });
          if (!effect.skipCollapse) needsCollapseCheck = true;
          break;
        }
        default:
          Logger.warn(`未知副作用类型: ${(effect as { type: string }).type}`);
      }
    }

    const collapseResult = needsCollapseCheck
      ? (this.checkAndPerformCollapse() ?? undefined)
      : undefined;

    return { visuals, collapseResult };
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

  resetRound(): void {
    this.currentDiscardChances = this.getEffectiveDiscardChancesPerRound();
    this.cardsPlayedThisRound = 0;
  }

  drawExact(count: number): CardData[] {
    const drawn = this._drawCards(count);
    this.hand.push(...drawn);
    return drawn;
  }

  private _computeFoundationValue(): number {
    let v = 0;
    for (const layer of this.board) {
      for (const card of layer.pokerSlots) {
        if (card) v += card.rank;
      }
    }
    return v;
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

  private _applyModifyCards(count: number, valueChange: number): VisualDelta[] {
    const allCards: { li: number; si: number; data: CardData }[] = [];
    for (let li = 0; li < this.board.length; li++) {
      for (let si = 0; si < this.board[li].pokerSlots.length; si++) {
        const c = this.board[li].pokerSlots[si];
        if (c) allCards.push({ li, si, data: c });
      }
    }
    const shuffled = shuffle(allCards).slice(0, count);
    const deltas: VisualDelta[] = [];
    for (const entry of shuffled) {
      const oldRank = entry.data.rank;
      const newRank = Math.max(2, Math.min(14, entry.data.rank + valueChange)) as Rank;
      entry.data.rank = newRank;
      Logger.effect(`  修改 Layer${entry.li}-Slot${entry.si}: ${Logger.fmtCard({ suit: entry.data.suit, rank: oldRank })} → rank ${newRank}`);
      deltas.push({ type: 'CARD_RANK_CHANGED', layerIndex: entry.li, slotIndex: entry.si, suit: entry.data.suit, newRank });
    }
    return deltas;
  }

  private _applyDestroySlots(layerIndex: number, count: number): VisualDelta[] {
    const occupied: number[] = [];
    for (let si = 0; si < this.board[layerIndex].pokerSlots.length; si++) {
      if (this.board[layerIndex].pokerSlots[si]) occupied.push(si);
    }
    const toDestroy = shuffle(occupied).slice(0, count);
    Logger.effect(`DESTROY_RANDOM_SLOT Layer${layerIndex}: 销毁格子 [${toDestroy.map(si => `Slot${si}`).join(', ')}]`);
    const deltas: VisualDelta[] = [];
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

  private _applyDestroyBoardCards(count: number): VisualDelta[] {
    const allCards: { li: number; si: number }[] = [];
    for (let li = 0; li < this.board.length; li++) {
      for (let si = 0; si < this.board[li].pokerSlots.length; si++) {
        if (this.board[li].pokerSlots[si]) allCards.push({ li, si });
      }
    }
    const toDestroy = shuffle(allCards).slice(0, count);
    const deltas: VisualDelta[] = [];
    for (const { li, si } of toDestroy) {
      const card = this.board[li].pokerSlots[si];
      if (card) {
        Logger.card('销毁棋盘牌', `${Logger.fmtCard(card)} (Layer${li}-Slot${si})`);
        this.discardPile.push(card);
        this.board[li].pokerSlots[si] = null;
        deltas.push({ type: 'SLOT_CLEARED', layerIndex: li, slotIndex: si });
      }
    }
    return deltas;
  }
}

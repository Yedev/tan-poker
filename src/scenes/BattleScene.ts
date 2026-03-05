import Phaser from 'phaser';
import type { CardData, CollapseResult, DetectedHand } from '../types/card';
import type { GamePhase } from '../types/game';
import type {
  BaseEventContext, LevelStartContext, CardPlacedContext, CardDiscardedContext,
  CardDrawnContext, ScoreStartContext, ScoreEndContext,
  LevelEndContext, CollapseTriggeredContext,
} from '../types/events';
import { GameState } from '../state/GameState';
import { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { EventBus } from '../events/EventBus';
import { PhaseManager } from '../logic/PhaseManager';
import { GameEngine } from '../logic/GameEngine';
import type { EffectDelta } from '../logic/GameEngine';
import { HandAnimator } from '../rendering/HandAnimator';
import { wouldCollapse, getLayerWeight } from '../logic/collapse';
import { Card } from '../gameobjects/Card';
import { BoardSlot } from '../gameobjects/BoardSlot';
import { EnhanceCard } from '../gameobjects/EnhanceCard';
import { ChallengeCard } from '../gameobjects/ChallengeCard';
import {
  BOARD_LAYOUT, LAYER_SLOT_COUNTS, SCORE_CHANCES_PER_LEVEL, DISCARD_CHANCES_PER_ROUND,
  DECK_PILE_X, DECK_PILE_Y, SLOT_HEIGHT,
  getTargetScore,
} from '../config';
import { Logger } from '../utils/Logger';

export class BattleScene extends Phaser.Scene {
  private phaseManager!: PhaseManager;
  private engine!: GameEngine;
  private handAnimator!: HandAnimator;
  private pokerSlots: BoardSlot[][] = [];
  private enhanceSlots: BoardSlot[] = [];
  private boardCardObjects: Map<string, Card> = new Map();
  private targetScore = 0;
  private level = 1;
  private isAnimating = false;
  private pendingFlyCount = 0;
  private pendingCollapseResult: CollapseResult | null = null;

  private weightTexts: Phaser.GameObjects.Text[] = [];
  private layerHighlightRects: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('BattleScene');
  }

  init(data: { level?: number }) {
    this.level = data.level ?? 1;
  }

  create() {
    const gs = GameState.getInstance();
    gs.currentLevel = this.level;
    this.targetScore = getTargetScore(this.level);

    this.engine = new GameEngine(SCORE_CHANCES_PER_LEVEL, DISCARD_CHANCES_PER_ROUND);
    this.handAnimator = new HandAnimator(this, DECK_PILE_X, DECK_PILE_Y);

    Logger.info(`━━━━━━━━━━ 关卡 ${this.level} 初始化 ━━━━━━━━━━`);
    Logger.info(`目标分数: ${this.targetScore}  计分次数: ${this.engine.scoreChances}  弃牌次数/轮: ${this.engine.discardChances}`);

    const ges = GameEventSystem.getInstance();
    ges.unregisterAll();
    gs.enhanceSlots.forEach((card, i) => {
      if (card) {
        Logger.info(`加载增益卡 [Layer${i}]: ${card.name} (${card.id})`);
        ges.registerAll(card.getHandlers(i));
      }
    });
    gs.challengeCards.forEach(card => {
      Logger.info(`加载挑战卡: ${card.name} (${card.id})`);
      ges.registerAll(card.getHandlers());
    });

    this.initBoard();
    this.engine.initDeck(gs.deck);
    this.setupDragHandlers();
    this.setupUIListeners();

    this.syncRegistry();
    this.scene.launch('UIScene');

    this.phaseManager = new PhaseManager((phase) => {
      this.registry.set('phase', phase);
      this.onPhaseEnter(phase);
    });

    this.phaseManager.transitionTo('LEVEL_START');

  }

  private initBoard() {
    this.pokerSlots = [];
    this.enhanceSlots = [];
    this.boardCardObjects.clear();
    this.weightTexts = [];
    this.layerHighlightRects = [];

    this.engine.initBoard(LAYER_SLOT_COUNTS);

    for (let li = 0; li < BOARD_LAYOUT.layers.length; li++) {
      const layout = BOARD_LAYOUT.layers[li];

      const rowSlots: BoardSlot[] = [];
      for (let si = 0; si < layout.pokerSlots.length; si++) {
        const pos = layout.pokerSlots[si];
        const slot = new BoardSlot(this, pos.x, layout.y, li, si, 'poker');
        slot.zone.input!.cursor = 'pointer';

        slot.zone.on('pointerup', (ptr: Phaser.Input.Pointer) => {
          if (!ptr.getDistance()) this.onSlotClicked(slot);
        });
        slot.zone.on('pointerover', () => {
          const hasSelected = this.handAnimator.handCards.some(c => c.isSelected);
          if (hasSelected && !slot.isOccupied && !this.isAnimating && this.phaseManager.getPhase() === 'PLAYER_PLACING') {
            slot.setHighlight('hover');
          }
        });
        slot.zone.on('pointerout', () => {
          if (!slot.isOccupied) slot.setHighlight('normal');
        });

        rowSlots.push(slot);
      }
      this.pokerSlots.push(rowSlots);

      const eSlot = new BoardSlot(
        this, layout.enhanceSlot.x, layout.y, li, 0, 'enhance',
      );
      this.enhanceSlots.push(eSlot);

      const gs = GameState.getInstance();
      const enhCardDef = gs.enhanceSlots[li];
      if (enhCardDef) {
        new EnhanceCard(this, layout.enhanceSlot.x, layout.y, enhCardDef).setDepth(3);
      }

      const wt = this.add.text(layout.enhanceSlot.x - 40, layout.y - 8, '', {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(5);
      this.weightTexts.push(wt);

      const leftX = layout.pokerSlots[0].x - 46;
      const rightX = layout.pokerSlots[layout.pokerSlots.length - 1].x + 46;
      const rectW = rightX - leftX;
      const rectCX = (leftX + rightX) / 2;
      const rect = this.add.rectangle(rectCX, layout.y, rectW, SLOT_HEIGHT + 16, 0x00ff88, 0)
        .setStrokeStyle(2, 0x00ff88, 0)
        .setAlpha(0)
        .setDepth(1);
      rect.setData('layerIndex', li);
      this.layerHighlightRects.push(rect);
    }

    const gs = GameState.getInstance();
    const foundLabel = gs.foundation === Infinity ? '∞' : `${gs.foundation}`;
    this.add.text(640, 490, `基层承重: ${foundLabel}`, {
      fontSize: '14px', color: '#7a8a7a', fontFamily: 'monospace',
    }).setOrigin(0.5);

    gs.challengeCards.forEach((cardDef, index) => {
      new ChallengeCard(this, 100, 150 + index * 100, cardDef).setDepth(3);
    });
  }

  private updateLayerHighlights() {
    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    const hasSelection = selected.length > 0;
    const canInteract = hasSelection && !this.isAnimating && this.phaseManager.getPhase() === 'PLAYER_PLACING';

    for (let li = 0; li < this.layerHighlightRects.length; li++) {
      const emptyCount = this.pokerSlots[li].filter(s => !s.isOccupied).length;
      const show = canInteract && emptyCount >= selected.length;
      const rect = this.layerHighlightRects[li];
      rect.setStrokeStyle(2, 0x00ff88, show ? 1 : 0);
      rect.setFillStyle(0x00ff88, show ? 0.08 : 0);
    }
  }

  private onLayerClicked(layerIndex: number) {
    if (this.isAnimating) return;
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    const emptySlots = this.pokerSlots[layerIndex].filter(s => !s.isOccupied);
    if (emptySlots.length < selected.length) return;

    for (let i = 0; i < selected.length; i++) {
      this.placeCard(selected[i], emptySlots[i]);
      // Stop if a collapse was triggered — further placements would go onto a cleared board
      if (this.pendingCollapseResult) break;
    }
  }

  private onSlotClicked(slot: BoardSlot) {
    if (this.isAnimating) return;
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (slot.isOccupied) return;

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    if (selected.length > 1) {
      this.onLayerClicked(slot.layerIndex);
    } else {
      this.placeCard(selected[0], slot);
    }
  }

  private setupDragHandlers() {
    this.input.dragDistanceThreshold = 8;

    this.input.on('gameobjectup', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.isAnimating) return;
      if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
      if (obj instanceof Card && obj.location === 'hand' && !_ptr.getDistance()) {
        obj.toggleSelect();
        this.updateLayerHighlights();
      }
    });

    this.input.on('dragstart', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.isAnimating) return;
      if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
      if (obj instanceof Card && obj.location === 'hand') {
        obj.stopFloat();
        obj.isSelected = false;
        obj.setAngle(obj.originalAngle);
        obj.setDepth(100);
        this.updateLayerHighlights();
      }
    });

    this.input.on('drag', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      if (obj instanceof Card) {
        obj.x = dragX;
        obj.y = dragY;
      }
    });

    this.input.on('dragenter', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, zone: Phaser.GameObjects.Zone) => {
      if (!(obj instanceof Card) || obj.location !== 'hand') return;
      const slot = zone.getData('boardSlot') as BoardSlot | undefined;
      if (!slot || slot.slotType !== 'poker' || slot.isOccupied) return;

      const gs = GameState.getInstance();
      const result = wouldCollapse(this.engine.board, gs.foundation + gs.tempFoundationBonus, slot.layerIndex, slot.slotIndex, obj.cardData);
      slot.setHighlight(result.collapsed ? 'danger' : 'hover');
      if (result.collapsed) {
        for (const di of result.destroyedLayerIndices) {
          for (const ps of this.pokerSlots[di]) {
            if (ps.isOccupied) ps.setHighlight('danger');
          }
        }
      }
    });

    this.input.on('dragleave', (_ptr: Phaser.Input.Pointer, _obj: Phaser.GameObjects.GameObject, zone: Phaser.GameObjects.Zone) => {
      const slot = zone.getData('boardSlot') as BoardSlot | undefined;
      if (slot) {
        slot.setHighlight('normal');
        for (const row of this.pokerSlots) {
          for (const s of row) {
            if (s !== slot) s.setHighlight('normal');
          }
        }
      }
    });

    this.input.on('drop', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, zone: Phaser.GameObjects.Zone) => {
      if (!(obj instanceof Card) || obj.location !== 'hand') return;
      const slot = zone.getData('boardSlot') as BoardSlot | undefined;
      if (!slot || slot.slotType !== 'poker' || slot.isOccupied) {
        (obj as Card).returnHome();
        return;
      }
      this.placeCard(obj, slot);
    });

    this.input.on('dragend', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dropped: boolean) => {
      if (!dropped && obj instanceof Card && obj.location === 'hand') {
        obj.returnHome();
        obj.setDepth(obj.homeDepth);
        this.updateLayerHighlights();
      }
    });
  }

  private setupUIListeners() {
    EventBus.on('ui:score-requested', this.onScoreRequested, this);
    EventBus.on('ui:discard-requested', this.onDiscardRequested, this);
  }

  private placeCard(card: Card, slot: BoardSlot) {
    Logger.card('放置', `${Logger.fmtCard(card.cardData)} → Layer${slot.layerIndex} Slot${slot.slotIndex}`);

    card.location = 'board';
    card.disableDrag();
    card.stopFloat();
    card.isSelected = false;
    card.clearTint();
    slot.isOccupied = true;
    slot.setHighlight('normal');
    this.boardCardObjects.set(`${slot.layerIndex}-${slot.slotIndex}`, card);

    const collapseResult = this.engine.placeCard(card.cardData, slot.layerIndex, slot.slotIndex);
    if (collapseResult) this.pendingCollapseResult = collapseResult;

    this.handAnimator.removeCard(card);

    // Deselect all remaining hand cards
    for (const c of this.handAnimator.handCards) {
      if (c.isSelected) c.deselect();
    }

    this.handAnimator.layout();

    const layerCards = this.engine.board[slot.layerIndex].pokerSlots.filter(Boolean) as CardData[];
    Logger.card('当前层', `Layer${slot.layerIndex}: [${Logger.fmtCards(layerCards)}]  weight=${getLayerWeight(this.engine.board[slot.layerIndex])}`);

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as CardPlacedContext;
    ctx.card = card.cardData;
    ctx.layerIndex = slot.layerIndex;
    ctx.slotIndex = slot.slotIndex;
    ges.emit(GAME_EVENTS.CARD_PLACED, ctx);

    this.updateWeightDisplay();
    this.updateLayerHighlights();

    // Fly animation to slot
    this.pendingFlyCount++;
    this.isAnimating = true;
    card.setDepth(100);
    this.tweens.add({
      targets: card,
      x: slot.x,
      y: slot.y,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        card.setDepth(5);
        this.pendingFlyCount--;
        if (this.pendingFlyCount === 0) {
          this.isAnimating = false;
          const result = this.pendingCollapseResult;
          this.pendingCollapseResult = null;
          if (result) this.executeCollapse(result);
        }
      },
    });
  }

  private runCollapseCheck() {
    const result = this.engine.checkAndPerformCollapse();
    if (result) this.executeCollapse(result);
  }

  private executeCollapse(result: CollapseResult) {
    Logger.collapse(
      `触发层: Layer${result.triggerLayerIndex}  销毁层: [${result.destroyedLayerIndices.map(i => `Layer${i}`).join(', ')}]  ` +
      `销毁卡牌: [${Logger.fmtCards(result.destroyedCards)}] (${result.destroyedCards.length} 张)`,
    );

    this.isAnimating = true;
    this.cameras.main.shake(300, 0.015);

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as CollapseTriggeredContext;
    ctx.triggerLayerIndex = result.triggerLayerIndex;
    ctx.destroyedLayerIndices = result.destroyedLayerIndices;
    ctx.destroyedCards = result.destroyedCards;
    ges.emit(GAME_EVENTS.COLLAPSE_TRIGGERED, ctx);

    for (const li of result.destroyedLayerIndices) {
      for (let si = 0; si < this.pokerSlots[li].length; si++) {
        const key = `${li}-${si}`;
        const cardObj = this.boardCardObjects.get(key);
        if (cardObj) {
          this.tweens.add({
            targets: cardObj,
            alpha: 0,
            y: cardObj.y - 40,
            duration: 400,
            onComplete: () => cardObj.destroy(),
          });
          this.boardCardObjects.delete(key);
        }
        this.pokerSlots[li][si].isOccupied = false;
      }
    }

    this.time.delayedCall(500, () => {
      this.isAnimating = false;
      this.updateWeightDisplay();
      this.updateLayerHighlights();
    });
  }

  private updateWeightDisplay() {
    for (let i = 0; i < this.engine.board.length; i++) {
      const w = getLayerWeight(this.engine.board[i]);
      this.weightTexts[i].setText(w > 0 ? `${w}` : '');
    }
  }

  private applyEffectDeltas(deltas: EffectDelta[]) {
    for (const d of deltas) {
      switch (d.type) {
        case 'CARD_RANK_CHANGED': {
          const key = `${d.layerIndex}-${d.slotIndex}`;
          this.boardCardObjects.get(key)?.setTexture(`card_${d.suit}_${d.newRank}`);
          break;
        }
        case 'SLOT_CLEARED': {
          const key = `${d.layerIndex}-${d.slotIndex}`;
          const obj = this.boardCardObjects.get(key);
          obj?.destroy();
          this.boardCardObjects.delete(key);
          this.pokerSlots[d.layerIndex][d.slotIndex].isOccupied = false;
          break;
        }
        case 'SCORE_CHANGED':
          this.registry.set('score', d.newScore);
          break;
        case 'HAND_TRIMMED':
          while (this.handAnimator.handCards.length > d.newCount) {
            const removed = this.handAnimator.handCards.pop()!;
            removed.destroy();
          }
          this.handAnimator.layout();
          break;
        case 'WEIGHT_UPDATE':
          this.updateWeightDisplay();
          break;
        case 'COLLAPSE_CHECK':
          this.runCollapseCheck();
          break;
      }
    }
  }

  // ── Phase Handling ──

  private onPhaseEnter(phase: GamePhase) {
    switch (phase) {
      case 'LEVEL_START': this.onLevelStart(); break;
      case 'PLAYER_PLACING': this.onPlayerPlacing(); break;
      case 'SCORING': this.onScoring(); break;
      case 'LEVEL_END': this.onLevelEnd(); break;
    }
  }

  private onLevelStart() {
    Logger.info(`━━ LEVEL_START: 关卡 ${this.level}  目标分 ${this.targetScore} ━━`);
    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as LevelStartContext;
    ctx.targetScore = this.targetScore;
    ges.emit(GAME_EVENTS.LEVEL_START, ctx);

    if (ctx.sideEffects) {
      const deltas = this.engine.applyEffects(ctx.sideEffects);
      this.applyEffectDeltas(deltas);
    }

    this.fillHand();

    this.time.delayedCall(400, () => {
      this.phaseManager.transitionTo('PLAYER_PLACING');
    });
  }

  private fillHand() {
    const gs = GameState.getInstance();
    const prevCount = this.handAnimator.handCards.length;
    const newCards = this.engine.fillHand(gs.handSize);
    this.registry.set('drawPileCount', this.engine.drawPile.length);

    for (const card of newCards) {
      const ges = GameEventSystem.getInstance();
      const ctx = this.buildBaseContext() as CardDrawnContext;
      ctx.card = card;
      Logger.card('摸牌', Logger.fmtCard(card));
      ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);
    }

    this.handAnimator.animateDraw(newCards, prevCount);
  }

  private onPlayerPlacing() {
    Logger.info(`PLAYER_PLACING — 手牌: [${Logger.fmtCards(this.handAnimator.handCards.map(c => c.cardData))}]`);
    for (const card of this.handAnimator.handCards) {
      card.enableDrag();
    }
    this.updateLayerHighlights();
  }

  private onScoreRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    this.phaseManager.transitionTo('SCORING');
  }

  private onDiscardRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    if (this.engine.discardChances <= 0) {
      Logger.warn('弃牌失败: 弃牌次数已用完');
      return;
    }

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    Logger.card('弃牌', `[${Logger.fmtCards(selected.map(c => c.cardData))}]  剩余弃牌次数: ${this.engine.discardChances - 1}`);
    this.engine.discardChances--;

    for (const card of selected) {
      const ges = GameEventSystem.getInstance();
      const ctx = this.buildBaseContext() as CardDiscardedContext;
      ctx.card = card.cardData;
      ges.emit(GAME_EVENTS.CARD_DISCARDED, ctx);
    }

    this.engine.discardFromHand(selected.map(c => c.cardData));
    for (const card of selected) {
      this.handAnimator.removeCard(card);
      card.destroy();
    }

    this.fillHand();
    for (const card of this.handAnimator.handCards) card.enableDrag();

    this.registry.set('discardChances', this.engine.discardChances);
    this.updateLayerHighlights();
  }

  private async onScoring() {
    Logger.score(`━━ SCORING 开始  计分机会剩余: ${this.engine.scoreChances}  当前总分: ${this.engine.levelScore} ━━`);
    this.isAnimating = true;
    this.updateLayerHighlights();
    for (const card of this.handAnimator.handCards) card.disableDrag();

    const ges = GameEventSystem.getInstance();

    const startCtx = this.buildBaseContext() as ScoreStartContext;
    startCtx.scoreChancesRemaining = this.engine.scoreChances;
    ges.emit(GAME_EVENTS.SCORE_START, startCtx);

    const results = this.engine.scoreAllLayers(this.buildBaseContext());

    let totalGained = 0;
    for (const result of results) {
      const enhEffects: string[] = [];
      const gs = GameState.getInstance();
      const enh = gs.enhanceSlots[result.layerIndex];
      if (enh) {
        if (result.scoreMultiplier !== 1.0) enhEffects.push(`×${result.scoreMultiplier.toFixed(1)}`);
        if (result.scoreBonusFlat > 0) enhEffects.push(`+${result.scoreBonusFlat}`);
        if (result.overrideLayerWeight === 0) enhEffects.push('承重→0');
      }
      await this.playLayerScoreAnimation(result.layerIndex, result.hands, result.layerScore, enhEffects);
      totalGained += result.layerScore;
    }

    Logger.score(`本次计分合计: +${totalGained.toFixed(1)}  累计总分: ${this.engine.levelScore} → ${this.engine.levelScore + totalGained}`);
    this.engine.addScore(totalGained);
    this.registry.set('score', this.engine.levelScore);

    const gs = GameState.getInstance();
    const goldEarned = Math.floor(totalGained / 10);
    if (goldEarned > 0) {
      gs.gold += goldEarned;
      this.registry.set('gold', gs.gold);
      Logger.info(`金币获得: +${goldEarned}  (共 ${gs.gold})`);
      this.playGoldEarnedAnimation(goldEarned);
    }

    const endCtx = this.buildBaseContext() as ScoreEndContext;
    endCtx.totalScoreGained = totalGained;
    ges.emit(GAME_EVENTS.SCORE_END, endCtx);
    if (endCtx.sideEffects) {
      Logger.effect(`SCORE_END sideEffects: ${JSON.stringify(endCtx.sideEffects)}`);
      const deltas = this.engine.applyEffects(endCtx.sideEffects);
      this.applyEffectDeltas(deltas);
    }

    this.engine.consumeScoreChance();
    this.registry.set('scoreChances', this.engine.scoreChances);
    Logger.score(`━━ SCORING 结束  计分机会剩余: ${this.engine.scoreChances}  当前总分: ${this.engine.levelScore} ━━`);

    this.engine.clearLayerOverrides();

    this.time.delayedCall(600, () => {
      this.isAnimating = false;
      if (this.engine.scoreChances > 0) {
        this.engine.resetDiscardChances(DISCARD_CHANCES_PER_ROUND);
        this.registry.set('discardChances', this.engine.discardChances);
        this.fillHand();
        this.phaseManager.transitionTo('PLAYER_PLACING');
      } else {
        this.phaseManager.transitionTo('LEVEL_END');
      }
    });
  }

  private playLayerScoreAnimation(layerIndex: number, hands: DetectedHand[], score: number, enhEffects: string[] = []): Promise<void> {
    return new Promise((resolve) => {
      const layout = BOARD_LAYOUT.layers[layerIndex];
      const centerX = layout.pokerSlots.reduce((s, p) => s + p.x, 0) / layout.pokerSlots.length;

      for (const slot of this.pokerSlots[layerIndex]) {
        const key = `${layerIndex}-${slot.slotIndex}`;
        const cardObj = this.boardCardObjects.get(key);
        if (cardObj) {
          this.tweens.add({
            targets: cardObj,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 150,
            yoyo: true,
          });
        }
      }

      const handLabel = hands.map(h => {
        const labels: Record<string, string> = {
          single: '单张', pair: '对子', three_of_a_kind: '三条',
          straight: '顺子', flush: '同花', straight_flush: '同花顺',
        };
        return labels[h.type] || h.type;
      }).join('+');

      const txt = this.add.text(centerX, layout.y - 50, `${handLabel} +${Math.floor(score)}`, {
        fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(50);

      if (enhEffects.length > 0) {
        const gs = GameState.getInstance();
        const enhName = gs.enhanceSlots[layerIndex]?.name ?? '';
        const enhTxt = this.add.text(
          layout.enhanceSlot.x, layout.y - 35,
          `⚡${enhName} ${enhEffects.join(' ')}`,
          { fontSize: '13px', color: '#ffaa22', fontFamily: 'sans-serif', stroke: '#000000', strokeThickness: 2 },
        ).setOrigin(0.5).setDepth(51);

        this.tweens.add({
          targets: enhTxt,
          y: enhTxt.y - 25,
          alpha: 0,
          duration: 900,
          delay: 300,
          onComplete: () => enhTxt.destroy(),
        });
      }

      this.tweens.add({
        targets: txt,
        y: txt.y - 30,
        alpha: 0,
        duration: 800,
        delay: 400,
        onComplete: () => {
          txt.destroy();
          resolve();
        },
      });
    });
  }

  private playGoldEarnedAnimation(amount: number) {
    const txt = this.add.text(420, 55, `+${amount} 金币`, {
      fontSize: '16px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: txt,
      y: txt.y - 25,
      alpha: 0,
      duration: 900,
      delay: 200,
      onComplete: () => txt.destroy(),
    });
  }

  private onLevelEnd() {
    const gs = GameState.getInstance();

    let foundationValue = 0;
    for (const layer of this.engine.board) {
      for (const card of layer.pokerSlots) {
        if (card) foundationValue += card.rank;
      }
    }

    const survived = this.engine.levelScore >= this.targetScore;
    Logger.info(
      `━━ LEVEL_END: 关卡 ${this.level}  得分 ${this.engine.levelScore} / 目标 ${this.targetScore}  ` +
      `结果: ${survived ? '✓ 通关' : '✗ 失败'}  新基层承重: ${foundationValue} ━━`,
    );

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as LevelEndContext;
    ctx.finalScore = this.engine.levelScore;
    ctx.targetScore = this.targetScore;
    ctx.survived = survived;
    ctx.foundationValue = foundationValue;
    ges.emit(GAME_EVENTS.LEVEL_END, ctx);

    gs.score += this.engine.levelScore;
    gs.foundation = foundationValue > 0 ? foundationValue : 1;

    if (survived) {
      const bonusGold = 5 + this.level * 2;
      gs.gold += bonusGold;
      this.registry.set('gold', gs.gold);
      Logger.info(`关卡通关奖励金币: +${bonusGold}  (共 ${gs.gold})`);
    }

    this.time.delayedCall(800, () => {
      this.cleanupScene();
      if (survived) {
        gs.currentLevel++;
        this.scene.start('ShopScene', { level: gs.currentLevel });
      } else {
        this.scene.start('GameOverScene');
      }
    });
  }

  private cleanupScene() {
    EventBus.off('ui:score-requested', this.onScoreRequested, this);
    EventBus.off('ui:discard-requested', this.onDiscardRequested, this);
    this.scene.stop('UIScene');
    GameEventSystem.getInstance().unregisterAll();
  }

  // ── Helpers ──

  private syncRegistry() {
    const gs = GameState.getInstance();
    this.registry.set('score', this.engine.levelScore);
    this.registry.set('targetScore', this.targetScore);
    this.registry.set('scoreChances', this.engine.scoreChances);
    this.registry.set('discardChances', this.engine.discardChances);
    this.registry.set('foundation', gs.foundation);
    this.registry.set('drawPileCount', this.engine.drawPile.length);
    this.registry.set('gold', gs.gold);
  }

  private buildBaseContext(): BaseEventContext {
    const gs = GameState.getInstance();
    return {
      phase: this.phaseManager.getPhase(),
      level: this.level,
      board: this.engine.board.map((l, i) => ({
        index: i,
        cards: l.pokerSlots.filter(Boolean) as CardData[],
        weight: getLayerWeight(l),
        enhanceCardId: gs.enhanceSlots[i]?.id ?? null,
      })),
      gameState: gs.getSnapshot(),
    };
  }
}

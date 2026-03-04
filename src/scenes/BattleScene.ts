import Phaser from 'phaser';
import type { CardData, Layer, DetectedHand } from '../types/card';
import type { GamePhase } from '../types/game';
import type {
  BaseEventContext, LevelStartContext, CardPlacedContext, CardDiscardedContext,
  CardDrawnContext, ScoreStartContext, ScoreLayerContext, ScoreEndContext,
  LevelEndContext, CollapseTriggeredContext,
} from '../types/events';
import { GameState } from '../state/GameState';
import { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { EventBus } from '../events/EventBus';
import { PhaseManager } from '../logic/PhaseManager';
import { shuffle, draw } from '../logic/deck';
import { detectHandType, calculateBaseScore } from '../logic/scoring';
import { checkCollapse, getLayerWeight, wouldCollapse } from '../logic/collapse';
import { Card } from '../gameobjects/Card';
import { BoardSlot } from '../gameobjects/BoardSlot';
import { EnhanceCard } from '../gameobjects/EnhanceCard';
import { ChallengeCard } from '../gameobjects/ChallengeCard';
import {
  BOARD_LAYOUT, HAND_Y, HAND_SPACING, GAME_WIDTH,
  LAYER_SLOT_COUNTS, SCORE_CHANCES_PER_LEVEL, DISCARD_CHANCES_PER_ROUND,
  DECK_PILE_X, DECK_PILE_Y, SLOT_HEIGHT,
  getTargetScore,
} from '../config';
import { Logger } from '../utils/Logger';

export class BattleScene extends Phaser.Scene {
  private phaseManager!: PhaseManager;
  private layers: Layer[] = [];
  private pokerSlots: BoardSlot[][] = [];
  private enhanceSlots: BoardSlot[] = [];
  private handCards: Card[] = [];
  private boardCardObjects: Map<string, Card> = new Map();
  private drawPile: CardData[] = [];
  private discardPile: CardData[] = [];
  private levelScore = 0;
  private targetScore = 0;
  private scoreChances = SCORE_CHANCES_PER_LEVEL;
  private discardChances = DISCARD_CHANCES_PER_ROUND;
  private level = 1;
  private isAnimating = false;

  private weightTexts: Phaser.GameObjects.Text[] = [];

  // Layer highlight rectangles (shown when cards are selected)
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
    this.levelScore = 0;
    this.scoreChances = SCORE_CHANCES_PER_LEVEL;
    this.discardChances = DISCARD_CHANCES_PER_ROUND;

    Logger.info(`━━━━━━━━━━ 关卡 ${this.level} 初始化 ━━━━━━━━━━`);
    Logger.info(`目标分数: ${this.targetScore}  计分次数: ${this.scoreChances}  弃牌次数/轮: ${this.discardChances}`);

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
    this.initDrawPile();
    this.setupDragHandlers();
    this.setupUIListeners();

    // syncRegistry must run BEFORE scene.launch('UIScene') so that when UIScene
    // boots synchronously and calls refreshFromRegistry(), all values are ready.
    this.syncRegistry();
    this.scene.launch('UIScene');

    this.phaseManager = new PhaseManager((phase) => {
      this.registry.set('phase', phase);
      this.onPhaseEnter(phase);
    });

    this.phaseManager.transitionTo('LEVEL_START');
  }

  private initBoard() {
    this.layers = [];
    this.pokerSlots = [];
    this.enhanceSlots = [];
    this.handCards = [];
    this.boardCardObjects.clear();
    this.weightTexts = [];
    this.layerHighlightRects = [];

    for (let li = 0; li < BOARD_LAYOUT.layers.length; li++) {
      const layout = BOARD_LAYOUT.layers[li];
      const slotCount = LAYER_SLOT_COUNTS[li];

      this.layers.push({
        pokerSlots: new Array(slotCount).fill(null),
      });

      const rowSlots: BoardSlot[] = [];
      for (let si = 0; si < layout.pokerSlots.length; si++) {
        const pos = layout.pokerSlots[si];
        const slot = new BoardSlot(this, pos.x, layout.y, li, si, 'poker');
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

      // Layer highlight rectangle for click-to-place interaction
      const leftX = layout.pokerSlots[0].x - 46;
      const rightX = layout.pokerSlots[layout.pokerSlots.length - 1].x + 46;
      const rectW = rightX - leftX;
      const rectCX = (leftX + rightX) / 2;
      const rect = this.add.rectangle(rectCX, layout.y, rectW, SLOT_HEIGHT + 16, 0x00ff88, 0)
        .setStrokeStyle(2, 0x00ff88, 0)
        .setAlpha(0)
        .setDepth(1);
      rect.setData('layerIndex', li);
      rect.setInteractive();
      rect.on('pointerup', (_ptr: Phaser.Input.Pointer) => {
        if (!_ptr.getDistance()) {
          this.onLayerClicked(li);
        }
      });
      rect.on('pointerover', () => {
        const selected = this.handCards.filter(c => c.isSelected);
        const hasEmpty = this.pokerSlots[li].some(s => !s.isOccupied);
        if (selected.length > 0 && hasEmpty) {
          rect.setFillStyle(0x00ff88, 0.25);
        }
      });
      rect.on('pointerout', () => {
        rect.setFillStyle(0x00ff88, 0);
      });
      this.layerHighlightRects.push(rect);
    }

    const gs = GameState.getInstance();
    const foundLabel = gs.foundation === Infinity ? '∞' : `${gs.foundation}`;
    this.add.text(640, 490, `基层承重: ${foundLabel}`, {
      fontSize: '14px', color: '#7a8a7a', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 渲染挑战卡
    gs.challengeCards.forEach((cardDef, index) => {
      new ChallengeCard(this, 100, 150 + index * 100, cardDef).setDepth(3);
    });
  }

  private initDrawPile() {
    const gs = GameState.getInstance();
    this.drawPile = shuffle([...gs.deck]);
    this.discardPile = [];
    Logger.deck(`牌库初始化  总牌数: ${this.drawPile.length}  [${Logger.fmtCards(this.drawPile)}]`);
  }

  private drawCards(count: number): CardData[] {
    if (this.drawPile.length < count) {
      Logger.deck(`牌库不足 (剩 ${this.drawPile.length})，将弃牌堆 ${this.discardPile.length} 张洗入牌库`);
      this.drawPile.push(...shuffle(this.discardPile));
      this.discardPile = [];
      Logger.deck(`洗牌后牌库: ${this.drawPile.length} 张`);
    }
    const drawn = draw(this.drawPile, count);
    Logger.deck(`摸牌 ${drawn.length} 张: [${Logger.fmtCards(drawn)}]  牌库剩余: ${this.drawPile.length}`);
    return drawn;
  }

  private fillHand() {
    const gs = GameState.getInstance();
    const need = gs.handSize - this.handCards.length;
    if (need <= 0) return;

    Logger.card('补手牌', `需要 ${need} 张 (手牌上限 ${gs.handSize}，当前 ${this.handCards.length})`);
    const drawn = this.drawCards(need);

    // Sync deck count after drawing
    this.registry.set('drawPileCount', this.drawPile.length);

    // Pre-calculate final hand positions for ALL cards (existing + new)
    const totalCount = this.handCards.length + drawn.length;

    // Snap existing hand cards to their updated positions
    const existingCount = this.handCards.length;
    for (let i = 0; i < existingCount; i++) {
      const card = this.handCards[i];
      const { x, y, angle } = this.handCardTransform(i, totalCount);
      card.setHome(x, y, angle);
      card.setPosition(x, y);
      card.setAngle(angle);
      card.setDepth(10 + i);
    }

    // Animate each new card flying from the deck pile to its hand position
    for (let i = 0; i < drawn.length; i++) {
      const cardData = drawn[i];
      const { x: finalX, y: finalY, angle: finalAngle } = this.handCardTransform(existingCount + i, totalCount);
      const finalDepth = 10 + existingCount + i;

      const card = new Card(this, DECK_PILE_X, DECK_PILE_Y, cardData);
      card.setTexture('card_back');

      card.location = 'hand';
      card.setDepth(finalDepth);
      this.handCards.push(card);

      this.tweens.add({
        targets: card,
        x: finalX,
        y: finalY,
        angle: finalAngle,
        duration: 260,
        delay: i * 75,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          card.setTexture(`card_${cardData.suit}_${cardData.rank}`);
          card.setHome(finalX, finalY, finalAngle);
          card.setDepth(finalDepth);
          this.tweens.add({
            targets: card,
            scaleX: 1.12,
            scaleY: 1.12,
            duration: 60,
            yoyo: true,
            ease: 'Quad.easeOut',
          });
        },
      });

      const ges = GameEventSystem.getInstance();
      const ctx = this.buildBaseContext() as CardDrawnContext;
      ctx.card = cardData;
      Logger.card('摸牌', Logger.fmtCard(cardData));
      ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);
    }
  }

  /**
   * Uniform fan arc, Balatro-style:
   *   t ∈ [-1, +1]  (left → right)
   *   angle = t × 10°          — symmetric fan rotation
   *   y     = HAND_Y + t² × 22 — parabolic arc, centre highest
   */
  private handCardTransform(index: number, total: number): { x: number; y: number; angle: number } {
    const totalWidth = (total - 1) * HAND_SPACING;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;
    const x = startX + index * HAND_SPACING;
    const t = total > 1 ? (index / (total - 1)) * 2 - 1 : 0;
    const angle = t * 10;
    const y = HAND_Y + t * t * 22;
    return { x, y, angle };
  }

  private layoutHand() {
    const count = this.handCards.length;
    if (count === 0) return;
    for (let i = 0; i < count; i++) {
      const card = this.handCards[i];
      const { x, y, angle } = this.handCardTransform(i, count);
      card.setHome(x, y, angle);
      card.setPosition(x, y);
      card.setAngle(angle);
      card.setDepth(10 + i);
    }
  }

  // ── Layer highlight (click-to-place) ──

  /**
   * Update layer highlight rectangles visibility based on current hand selection.
   * When cards are selected and a layer has available slots, highlight that layer.
   */
  private updateLayerHighlights() {
    const selected = this.handCards.filter(c => c.isSelected);
    const hasSelection = selected.length > 0;
    const canInteract = hasSelection && !this.isAnimating && this.phaseManager.getPhase() === 'PLAYER_PLACING';

    for (let li = 0; li < this.layerHighlightRects.length; li++) {
      const hasEmptySlot = this.pokerSlots[li].some(s => !s.isOccupied);
      const show = canInteract && hasEmptySlot;
      const rect = this.layerHighlightRects[li];
      rect.setStrokeStyle(2, 0x00ff88, show ? 1 : 0);
      rect.setFillStyle(0x00ff88, 0);
      if (show) {
        rect.setInteractive();
      } else {
        rect.disableInteractive();
      }
    }
  }

  /**
   * Place the currently selected hand cards into the first available slots of layerIndex.
   */
  private onLayerClicked(layerIndex: number) {
    if (this.isAnimating) return;
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;

    const selected = this.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    const emptySlots = this.pokerSlots[layerIndex].filter(s => !s.isOccupied);
    if (emptySlots.length === 0) return;

    const toPlace = selected.slice(0, emptySlots.length);
    for (let i = 0; i < toPlace.length; i++) {
      this.placeCard(toPlace[i], emptySlots[i]);
    }
  }

  private setupDragHandlers() {
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
        obj.setDepth(100);
        obj.deselect();
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
      const result = wouldCollapse(this.layers, gs.foundation + gs.tempFoundationBonus, slot.layerIndex, slot.slotIndex, obj.cardData);
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
        obj.setDepth(10);
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
    card.setPosition(slot.x, slot.y);
    card.setAngle(0);
    card.setDepth(5);
    slot.isOccupied = true;
    slot.setHighlight('normal');

    this.layers[slot.layerIndex].pokerSlots[slot.slotIndex] = card.cardData;

    const idx = this.handCards.indexOf(card);
    if (idx >= 0) this.handCards.splice(idx, 1);
    this.boardCardObjects.set(`${slot.layerIndex}-${slot.slotIndex}`, card);
    this.layoutHand();

    // 打印当前层牌面状态
    const layerCards = this.layers[slot.layerIndex].pokerSlots.filter(Boolean) as CardData[];
    Logger.card('当前层', `Layer${slot.layerIndex}: [${Logger.fmtCards(layerCards)}]  weight=${getLayerWeight(this.layers[slot.layerIndex])}`);

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as CardPlacedContext;
    ctx.card = card.cardData;
    ctx.layerIndex = slot.layerIndex;
    ctx.slotIndex = slot.slotIndex;
    ges.emit(GAME_EVENTS.CARD_PLACED, ctx);

    this.updateWeightDisplay();
    this.updateLayerHighlights();
    this.runCollapseCheck();
  }

  private runCollapseCheck() {
    const gs = GameState.getInstance();
    const result = checkCollapse(this.layers, gs.foundation + gs.tempFoundationBonus);
    if (result.collapsed) {
      this.executeCollapse(result.triggerLayerIndex, result.destroyedLayerIndices, result.destroyedCards);
    }
  }

  private executeCollapse(triggerLayer: number, destroyedIndices: number[], destroyedCards: CardData[]) {
    Logger.collapse(
      `触发层: Layer${triggerLayer}  销毁层: [${destroyedIndices.map(i => `Layer${i}`).join(', ')}]  ` +
      `销毁卡牌: [${Logger.fmtCards(destroyedCards)}] (${destroyedCards.length} 张)`,
    );

    this.isAnimating = true;
    this.cameras.main.shake(300, 0.015);

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as CollapseTriggeredContext;
    ctx.triggerLayerIndex = triggerLayer;
    ctx.destroyedLayerIndices = destroyedIndices;
    ctx.destroyedCards = destroyedCards;
    ges.emit(GAME_EVENTS.COLLAPSE_TRIGGERED, ctx);

    for (const li of destroyedIndices) {
      for (let si = 0; si < this.layers[li].pokerSlots.length; si++) {
        const key = `${li}-${si}`;
        const cardObj = this.boardCardObjects.get(key);
        if (cardObj) {
          this.discardPile.push(cardObj.cardData);
          this.tweens.add({
            targets: cardObj,
            alpha: 0,
            y: cardObj.y - 40,
            duration: 400,
            onComplete: () => cardObj.destroy(),
          });
          this.boardCardObjects.delete(key);
        }
        this.layers[li].pokerSlots[si] = null;
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
    for (let i = 0; i < this.layers.length; i++) {
      const w = getLayerWeight(this.layers[i]);
      this.weightTexts[i].setText(w > 0 ? `${w}` : '');
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

    if (ctx.sideEffects) this.applySideEffects(ctx.sideEffects);

    this.fillHand();

    this.time.delayedCall(400, () => {
      this.phaseManager.transitionTo('PLAYER_PLACING');
    });
  }

  private onPlayerPlacing() {
    Logger.info(`PLAYER_PLACING — 手牌: [${Logger.fmtCards(this.handCards.map(c => c.cardData))}]`);
    for (const card of this.handCards) {
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
    if (this.discardChances <= 0) {
      Logger.warn('弃牌失败: 弃牌次数已用完');
      return;
    }

    const selected = this.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    Logger.card('弃牌', `[${Logger.fmtCards(selected.map(c => c.cardData))}]  剩余弃牌次数: ${this.discardChances - 1}`);
    this.discardChances--;

    for (const card of selected) {
      const ges = GameEventSystem.getInstance();
      const ctx = this.buildBaseContext() as CardDiscardedContext;
      ctx.card = card.cardData;
      ges.emit(GAME_EVENTS.CARD_DISCARDED, ctx);

      this.discardPile.push(card.cardData);
      const idx = this.handCards.indexOf(card);
      if (idx >= 0) this.handCards.splice(idx, 1);
      card.destroy();
    }

    this.fillHand();
    for (const card of this.handCards) card.enableDrag();

    this.registry.set('discardChances', this.discardChances);
    this.updateLayerHighlights();
  }

  private async onScoring() {
    Logger.score(`━━ SCORING 开始  计分机会剩余: ${this.scoreChances}  当前总分: ${this.levelScore} ━━`);
    this.isAnimating = true;
    this.updateLayerHighlights(); // hide highlights during scoring
    for (const card of this.handCards) card.disableDrag();

    const ges = GameEventSystem.getInstance();

    const startCtx = this.buildBaseContext() as ScoreStartContext;
    startCtx.scoreChancesRemaining = this.scoreChances;
    ges.emit(GAME_EVENTS.SCORE_START, startCtx);

    let totalGained = 0;

    for (let li = 0; li < this.layers.length; li++) {
      const cards = this.layers[li].pokerSlots.filter(Boolean) as CardData[];
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

      Logger.score(
        `Layer${li}: [${Logger.fmtCards(cards)}]  手型=${handNames}  基础分=${baseScore}`,
      );

      const layerCtx: ScoreLayerContext = {
        ...this.buildBaseContext(),
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
        this.layers[li].overrideWeight = layerCtx.overrideLayerWeight;
        Logger.score(`  Layer${li}: 承重覆盖 → ${layerCtx.overrideLayerWeight}`);
      }

      const layerScore = baseScore * layerCtx.scoreMultiplier + layerCtx.scoreBonusFlat;
      Logger.score(
        `  Layer${li}: ${baseScore} × ${layerCtx.scoreMultiplier.toFixed(2)} + ${layerCtx.scoreBonusFlat} = ${layerScore.toFixed(1)}`,
      );
      totalGained += layerScore;

      const enhEffects: string[] = [];
      const gs = GameState.getInstance();
      const enh = gs.enhanceSlots[li];
      if (enh) {
        if (layerCtx.scoreMultiplier !== 1.0) enhEffects.push(`×${layerCtx.scoreMultiplier.toFixed(1)}`);
        if (layerCtx.scoreBonusFlat > 0) enhEffects.push(`+${layerCtx.scoreBonusFlat}`);
        if (layerCtx.overrideLayerWeight === 0) enhEffects.push('承重→0');
      }

      await this.playLayerScoreAnimation(li, hands, layerScore, enhEffects);
    }

    Logger.score(`本次计分合计: +${totalGained.toFixed(1)}  累计总分: ${this.levelScore} → ${this.levelScore + totalGained}`);
    this.levelScore += totalGained;
    this.registry.set('score', this.levelScore);

    // Award gold based on score earned this round
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
      this.applySideEffects(endCtx.sideEffects);
    }

    this.scoreChances--;
    this.registry.set('scoreChances', this.scoreChances);
    Logger.score(`━━ SCORING 结束  计分机会剩余: ${this.scoreChances}  当前总分: ${this.levelScore} ━━`);

    // 清除本轮计分产生的承重覆盖，避免影响下一轮放牌阶段的坍塌判定
    for (const layer of this.layers) {
      layer.overrideWeight = undefined;
    }

    this.time.delayedCall(600, () => {
      this.isAnimating = false;
      if (this.scoreChances > 0) {
        this.discardChances = DISCARD_CHANCES_PER_ROUND;
        this.registry.set('discardChances', this.discardChances);
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
    for (const layer of this.layers) {
      for (const card of layer.pokerSlots) {
        if (card) foundationValue += card.rank;
      }
    }

    const survived = this.levelScore >= this.targetScore;
    Logger.info(
      `━━ LEVEL_END: 关卡 ${this.level}  得分 ${this.levelScore} / 目标 ${this.targetScore}  ` +
      `结果: ${survived ? '✓ 通关' : '✗ 失败'}  新基层承重: ${foundationValue} ━━`,
    );

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as LevelEndContext;
    ctx.finalScore = this.levelScore;
    ctx.targetScore = this.targetScore;
    ctx.survived = survived;
    ctx.foundationValue = foundationValue;
    ges.emit(GAME_EVENTS.LEVEL_END, ctx);

    gs.score += this.levelScore;
    gs.foundation = foundationValue > 0 ? foundationValue : 1;

    // Bonus gold for completing a level
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
    this.registry.set('score', this.levelScore);
    this.registry.set('targetScore', this.targetScore);
    this.registry.set('scoreChances', this.scoreChances);
    this.registry.set('discardChances', this.discardChances);
    this.registry.set('foundation', gs.foundation);
    this.registry.set('drawPileCount', this.drawPile.length);
    this.registry.set('gold', gs.gold);
  }

  private buildBaseContext(): BaseEventContext {
    const gs = GameState.getInstance();
    return {
      phase: this.phaseManager.getPhase(),
      level: this.level,
      board: this.layers.map((l, i) => ({
        index: i,
        cards: l.pokerSlots.filter(Boolean) as CardData[],
        weight: getLayerWeight(l),
        enhanceCardId: gs.enhanceSlots[i]?.id ?? null,
      })),
      gameState: gs.getSnapshot(),
    };
  }

  private applySideEffects(effects: Array<{ type: string;[k: string]: unknown }>) {
    for (const effect of effects) {
      Logger.effect(`执行副作用: ${effect.type}  参数: ${JSON.stringify(effect)}`);
      switch (effect.type) {
        case 'MODIFY_RANDOM_CARDS': {
          const count = (effect.count as number) || 1;
          const change = (effect.valueChange as number) || 0;
          Logger.effect(`MODIFY_RANDOM_CARDS: 随机修改 ${count} 张棋盘牌  rank ${change >= 0 ? '+' : ''}${change}`);
          this.modifyRandomBoardCards(count, change);
          if (effect.recalculateCollapse) this.runCollapseCheck();
          break;
        }
        case 'MODIFY_TOTAL_SCORE': {
          const mult = (effect.multiplier as number) || 1;
          const before = this.levelScore;
          this.levelScore = Math.floor(this.levelScore * mult);
          Logger.effect(`MODIFY_TOTAL_SCORE: ${before} × ${mult} → ${this.levelScore}`);
          this.registry.set('score', this.levelScore);
          break;
        }
        case 'MODIFY_HAND_SIZE': {
          const delta = (effect.delta as number) || 0;
          const gs = GameState.getInstance();
          const before = gs.handSize;
          gs.handSize += delta;
          Logger.effect(`MODIFY_HAND_SIZE: ${before} → ${gs.handSize}  (${delta >= 0 ? '+' : ''}${delta})`);
          if (effect.trimExcess) {
            while (this.handCards.length > gs.handSize && this.handCards.length > 0) {
              const removed = this.handCards.pop()!;
              Logger.card('手牌超限移除', Logger.fmtCard(removed.cardData));
              this.discardPile.push(removed.cardData);
              removed.destroy();
            }
            this.layoutHand();
          }
          break;
        }
        case 'DESTROY_RANDOM_SLOT': {
          const li = (effect.layerIndex as number) ?? 2;
          const cnt = (effect.count as number) || 1;
          Logger.effect(`DESTROY_RANDOM_SLOT: Layer${li} 销毁 ${cnt} 个格子`);
          this.destroyRandomSlots(li, cnt);
          break;
        }
        default:
          Logger.warn(`未知副作用类型: ${effect.type}`);
      }
    }
  }

  private modifyRandomBoardCards(count: number, valueChange: number) {
    const allCards: { li: number; si: number; data: CardData }[] = [];
    for (let li = 0; li < this.layers.length; li++) {
      for (let si = 0; si < this.layers[li].pokerSlots.length; si++) {
        const c = this.layers[li].pokerSlots[si];
        if (c) allCards.push({ li, si, data: c });
      }
    }
    const shuffled = shuffle(allCards).slice(0, count);
    for (const entry of shuffled) {
      const oldRank = entry.data.rank;
      const newRank = Math.max(2, Math.min(14, entry.data.rank + valueChange));
      entry.data.rank = newRank as CardData['rank'];
      Logger.effect(`  修改 Layer${entry.li}-Slot${entry.si}: ${Logger.fmtCard({ suit: entry.data.suit, rank: oldRank })} → rank ${newRank}`);
      const key = `${entry.li}-${entry.si}`;
      const obj = this.boardCardObjects.get(key);
      if (obj) {
        obj.setTexture(`card_${entry.data.suit}_${entry.data.rank}`);
      }
    }
    this.updateWeightDisplay();
  }

  private destroyRandomSlots(layerIndex: number, count: number) {
    const occupied: number[] = [];
    for (let si = 0; si < this.layers[layerIndex].pokerSlots.length; si++) {
      if (this.layers[layerIndex].pokerSlots[si]) occupied.push(si);
    }
    const toDestroy = shuffle(occupied).slice(0, count);
    Logger.effect(`DESTROY_RANDOM_SLOT Layer${layerIndex}: 销毁格子 [${toDestroy.map(si => `Slot${si}`).join(', ')}]`);
    for (const si of toDestroy) {
      const key = `${layerIndex}-${si}`;
      const obj = this.boardCardObjects.get(key);
      if (obj) {
        Logger.card('销毁', `${Logger.fmtCard(obj.cardData)} (Layer${layerIndex}-Slot${si})`);
        this.discardPile.push(obj.cardData);
        obj.destroy();
        this.boardCardObjects.delete(key);
      }
      this.layers[layerIndex].pokerSlots[si] = null;
      this.pokerSlots[layerIndex][si].isOccupied = false;
    }
    this.updateWeightDisplay();
  }
}

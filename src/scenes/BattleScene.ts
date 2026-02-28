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
import {
  BOARD_LAYOUT, HAND_Y, HAND_SPACING, GAME_WIDTH,
  LAYER_SLOT_COUNTS, SCORE_CHANCES_PER_LEVEL, DISCARD_CHANCES_PER_ROUND,
  getTargetScore,
} from '../config';

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

  constructor() {
    super('BattleScene');
  }

  init(data: { level?: number }) {
    this.level = data.level ?? 1;
  }

  create() {
    this.scene.launch('UIScene');

    const gs = GameState.getInstance();
    gs.currentLevel = this.level;
    this.targetScore = getTargetScore(this.level);
    this.levelScore = 0;
    this.scoreChances = SCORE_CHANCES_PER_LEVEL;
    this.discardChances = DISCARD_CHANCES_PER_ROUND;

    const ges = GameEventSystem.getInstance();
    ges.unregisterAll();
    gs.enhanceSlots.forEach((card, i) => {
      if (card) ges.registerAll(card.getHandlers(i));
    });
    gs.challengeCards.forEach(card => {
      ges.registerAll(card.getHandlers());
    });

    this.initBoard();
    this.initDrawPile();
    this.setupDragHandlers();
    this.setupUIListeners();

    this.syncRegistry();

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
    this.boardCardObjects.clear();
    this.weightTexts = [];

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

      const wt = this.add.text(layout.enhanceSlot.x - 40, layout.y - 8, '', {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(5);
      this.weightTexts.push(wt);
    }

    const gs = GameState.getInstance();
    const foundLabel = gs.foundation === Infinity ? '∞' : `${gs.foundation}`;
    this.add.text(640, 475, `基层承重: ${foundLabel}`, {
      fontSize: '14px', color: '#7a8a7a', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private initDrawPile() {
    const gs = GameState.getInstance();
    this.drawPile = shuffle([...gs.deck]);
    this.discardPile = [];
  }

  private drawCards(count: number): CardData[] {
    if (this.drawPile.length < count) {
      this.drawPile.push(...shuffle(this.discardPile));
      this.discardPile = [];
    }
    return draw(this.drawPile, count);
  }

  private fillHand() {
    const gs = GameState.getInstance();
    const need = gs.handSize - this.handCards.length;
    if (need <= 0) return;
    const drawn = this.drawCards(need);
    for (const cardData of drawn) {
      const card = new Card(this, 0, HAND_Y, cardData);
      card.location = 'hand';
      card.setDepth(10);
      this.handCards.push(card);

      const ges = GameEventSystem.getInstance();
      const ctx = this.buildBaseContext() as CardDrawnContext;
      ctx.card = cardData;
      ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);
    }
    this.layoutHand();
  }

  private layoutHand() {
    const count = this.handCards.length;
    if (count === 0) return;
    const totalWidth = (count - 1) * HAND_SPACING;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;
    for (let i = 0; i < count; i++) {
      const card = this.handCards[i];
      const x = startX + i * HAND_SPACING;
      card.setHome(x, HAND_Y);
      card.setPosition(x, HAND_Y);
      card.setDepth(10 + i);
    }
  }

  private setupDragHandlers() {
    this.input.on('dragstart', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.isAnimating) return;
      if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
      if (obj instanceof Card && obj.location === 'hand') {
        obj.setDepth(100);
        obj.deselect();
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
            if (s !== slot) s.setHighlight(s.isOccupied ? 'normal' : 'normal');
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
      }
    });
  }

  private setupUIListeners() {
    EventBus.on('ui:score-requested', this.onScoreRequested, this);
    EventBus.on('ui:discard-requested', this.onDiscardRequested, this);
  }

  private placeCard(card: Card, slot: BoardSlot) {
    card.location = 'board';
    card.disableDrag();
    card.setPosition(slot.x, slot.y);
    card.setDepth(5);
    slot.isOccupied = true;
    slot.setHighlight('normal');

    this.layers[slot.layerIndex].pokerSlots[slot.slotIndex] = card.cardData;

    const idx = this.handCards.indexOf(card);
    if (idx >= 0) this.handCards.splice(idx, 1);
    this.boardCardObjects.set(`${slot.layerIndex}-${slot.slotIndex}`, card);
    this.layoutHand();

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as CardPlacedContext;
    ctx.card = card.cardData;
    ctx.layerIndex = slot.layerIndex;
    ctx.slotIndex = slot.slotIndex;
    ges.emit(GAME_EVENTS.CARD_PLACED, ctx);

    this.updateWeightDisplay();
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
    for (const card of this.handCards) {
      card.enableDrag();
    }
  }

  private onScoreRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    this.phaseManager.transitionTo('SCORING');
  }

  private onDiscardRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    if (this.discardChances <= 0) return;

    const selected = this.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

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
  }

  private async onScoring() {
    this.isAnimating = true;
    for (const card of this.handCards) card.disableDrag();

    const ges = GameEventSystem.getInstance();

    const startCtx = this.buildBaseContext() as ScoreStartContext;
    startCtx.scoreChancesRemaining = this.scoreChances;
    ges.emit(GAME_EVENTS.SCORE_START, startCtx);

    let totalGained = 0;

    for (let li = 0; li < this.layers.length; li++) {
      const cards = this.layers[li].pokerSlots.filter(Boolean) as CardData[];
      if (cards.length === 0) continue;

      const hands = detectHandType(cards);
      const baseScore = calculateBaseScore(hands);

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
      }

      const layerScore = baseScore * layerCtx.scoreMultiplier + layerCtx.scoreBonusFlat;
      totalGained += layerScore;

      await this.playLayerScoreAnimation(li, hands, layerScore);
    }

    this.levelScore += totalGained;
    this.registry.set('score', this.levelScore);

    const endCtx = this.buildBaseContext() as ScoreEndContext;
    endCtx.totalScoreGained = totalGained;
    ges.emit(GAME_EVENTS.SCORE_END, endCtx);
    if (endCtx.sideEffects) this.applySideEffects(endCtx.sideEffects);

    this.scoreChances--;
    this.registry.set('scoreChances', this.scoreChances);

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

  private playLayerScoreAnimation(layerIndex: number, hands: DetectedHand[], score: number): Promise<void> {
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

  private onLevelEnd() {
    const gs = GameState.getInstance();

    let foundationValue = 0;
    for (const layer of this.layers) {
      for (const card of layer.pokerSlots) {
        if (card) foundationValue += card.rank;
      }
    }

    const survived = this.levelScore >= this.targetScore;

    const ges = GameEventSystem.getInstance();
    const ctx = this.buildBaseContext() as LevelEndContext;
    ctx.finalScore = this.levelScore;
    ctx.targetScore = this.targetScore;
    ctx.survived = survived;
    ctx.foundationValue = foundationValue;
    ges.emit(GAME_EVENTS.LEVEL_END, ctx);

    gs.score += this.levelScore;
    gs.foundation = foundationValue > 0 ? foundationValue : 1;

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
    this.registry.set('score', this.levelScore);
    this.registry.set('targetScore', this.targetScore);
    this.registry.set('scoreChances', this.scoreChances);
    this.registry.set('discardChances', this.discardChances);
    this.registry.set('foundation', GameState.getInstance().foundation);
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
      switch (effect.type) {
        case 'MODIFY_RANDOM_CARDS': {
          const count = (effect.count as number) || 1;
          const change = (effect.valueChange as number) || 0;
          this.modifyRandomBoardCards(count, change);
          if (effect.recalculateCollapse) this.runCollapseCheck();
          break;
        }
        case 'MODIFY_TOTAL_SCORE': {
          const mult = (effect.multiplier as number) || 1;
          this.levelScore = Math.floor(this.levelScore * mult);
          this.registry.set('score', this.levelScore);
          break;
        }
        case 'MODIFY_HAND_SIZE': {
          const delta = (effect.delta as number) || 0;
          GameState.getInstance().handSize += delta;
          if (effect.trimExcess) {
            while (this.handCards.length > GameState.getInstance().handSize && this.handCards.length > 0) {
              const removed = this.handCards.pop()!;
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
          this.destroyRandomSlots(li, cnt);
          break;
        }
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
      const newRank = Math.max(2, Math.min(14, entry.data.rank + valueChange));
      entry.data.rank = newRank as CardData['rank'];
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
    for (const si of toDestroy) {
      const key = `${layerIndex}-${si}`;
      const obj = this.boardCardObjects.get(key);
      if (obj) {
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

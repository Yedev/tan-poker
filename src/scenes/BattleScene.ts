import Phaser from 'phaser';
import type { CardData, CollapseResult, DetectedHand } from '../types/card';
import type { GamePhase } from '../types/game';
import type {
  BaseEventContext, LevelStartContext, CardPlacedContext, CardDiscardedContext,
  CardDrawnContext, ScoreStartContext, ScoreEndContext,
  LevelEndContext, CollapseTriggeredContext, LayerScoreResult,
} from '../types/events';
import { PlayerProfile } from '../state/PlayerProfile';
import { LevelRuntime } from '../state/LevelRuntime';
import type { VisualDelta, LevelResult } from '../state/LevelRuntime';
import { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { EventBus } from '../events/EventBus';
import { PhaseManager } from '../state/PhaseManager';
import { HandAnimator } from '../animators/HandAnimator';
import { HAND_TYPE_LABELS } from '../logic/scoring';
import { computeRoundScore } from '../logic/ScoreEngine';
import { wouldCollapse, checkCollapse, getLayerWeight } from '../logic/collapse';
import { Card } from '../gameobjects/Card';
import { BoardSlot } from '../gameobjects/BoardSlot';
import { EnhanceCard } from '../gameobjects/EnhanceCard';
import { ChallengeCardPanel } from '../gameobjects/ChallengeCardPanel';
import {
  BOARD_LAYOUT, BOARD_TOP_Y, LAYER_SLOT_COUNTS,
  DECK_PILE_X, DECK_PILE_Y, SLOT_WIDTH, SLOT_HEIGHT,
  GAME_WIDTH, GAME_HEIGHT,
} from '../config';
import { getLevelConfig } from '../config/levels';
import { generateChallengeCards } from '../cards/challenge';
import { Logger } from '../utils/Logger';

/**
 * BattleScene - 主战斗场景
 *
 * 游戏流程:
 * 1. LEVEL_START   - 初始化关卡、注册卡牌事件处理器、摸牌
 * 2. PLAYER_PLACING - 玩家拖拽手牌到棋盘格子
 * 3. SCORING      - 触发计分、计算得分、应用副作用
 * 4. LEVEL_END    - 判定通关/失败、进入商店或结束画面
 *
 * 核心状态:
 * - LevelRuntime: 关卡运行时数据（棋盘、手牌、分数等）
 * - GameEventSystem: 事件系统，处理增强/挑战卡效果
 * - PhaseManager: 状态机，管理游戏阶段流转
 *
 * 事件流向:
 * 手牌点击/拖拽 → placeCard() → CARD_PLACED 事件 → 副作用
 *                                                          ↓
 * 计分按钮 → onScoreRequested() → SCORE_START → scoreAllLayers() → SCORE_END → 副作用
 *                                                          ↓
 * 结算判断 → shouldEndLevel() → LEVEL_END → concludeLevel() → 场景切换
 */

/**
 * BattleScene - 主战斗场景
 *
 * 游戏流程:
 * 1. LEVEL_START   - 初始化关卡、注册卡牌事件处理器、摸牌
 * 2. PLAYER_PLACING - 玩家拖拽手牌到棋盘格子
 * 3. SCORING      - 触发计分、计算得分、应用副作用
 * 4. LEVEL_END    - 判定通关/失败、进入商店或结束画面
 *
 * 核心状态:
 * - LevelRuntime: 关卡运行时数据（棋盘、手牌、分数等）
 * - GameEventSystem: 事件系统，处理增强/挑战卡效果
 * - PhaseManager: 状态机，管理游戏阶段流转
 *
 * 事件流向:
 * 手牌点击/拖拽 → placeCard() → CARD_PLACED 事件 → 副作用
 *                                                          ↓
 * 计分按钮 → onScoreRequested() → SCORE_START → scoreAllLayers() → SCORE_END → 副作用
 *                                                          ↓
 * 结算判断 → shouldEndLevel() → LEVEL_END → concludeLevel() → 场景切换
 */

export class BattleScene extends Phaser.Scene {
  // ── 核心管理器 ─────────────────────────────────────────────────────────────
  private phaseManager!: PhaseManager;          // 阶段状态机
  private levelRuntime!: LevelRuntime;          // 关卡运行时数据
  private handAnimator!: HandAnimator;           // 手牌动画管理
  private eventSystem!: GameEventSystem;        // 事件系统（处理增强/挑战卡）

  // ── 棋盘对象 ─────────────────────────────────────────────────────────────
  private pokerSlots: BoardSlot[][] = [];      // 扑克牌槽 [layer][slot]
  private enhanceSlots: BoardSlot[] = [];       // 增强卡槽（每层一个）
  private boardCardObjects: Map<string, Card> = new Map(); // 棋盘上的卡牌对象

  // ── 游戏状态 ─────────────────────────────────────────────────────────────
  private targetScore = 0;                      // 本关目标分数
  private level = 1;                            // 当前关卡
  private isAnimating = false;                  // 是否正在播放动画（阻塞交互）
  private collapseDepth = 0;                    // 嵌套坍塌计数，防止提前解锁交互
  private pendingCollapseResult: CollapseResult | null = null; // 待处理的坍塌结果

  // ── UI 组件 ─────────────────────────────────────────────────────────────
  private weightTexts: Phaser.GameObjects.Text[] = [];          // 层权重显示
  private hoverPreviewCard: Card | null = null;                 // 拖拽预览卡
  private challengePanel: ChallengeCardPanel | null = null;      // 挑战卡面板
  private bgm: Phaser.Sound.BaseSound | null = null; // 背景音乐

  constructor() {
    super('BattleScene');
  }

  /**
   * 场景初始化 - 从 TitleScene 或 ShopScene 传入关卡号
   */
  init(data: { level?: number }) {
    this.level = data.level ?? 1;
  }

  /**
   * 场景创建 - 初始化所有游戏组件
   *
   * 初始化顺序:
   * 1. 创建背景
   * 2. 创建 LevelRuntime（关卡运行时）
   * 3. 创建 GameEventSystem（事件系统）
   * 4. 创建手牌动画管理器
   * 5. 初始化棋盘格子
   * 6. 注册增强/挑战卡事件处理器
   * 7. 启动阶段状态机
   */
  create() {
    // 背景音乐
    this.bgm = this.sound.add('battle_bgm', { loop: true, volume: 0.4 });
    this.bgm.play();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 9999, 9999, 0x091a28).setDepth(-1);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'game_bg').setDepth(0);

    const profile = PlayerProfile.getInstance();
    profile.currentLevel = this.level;

    const cfg = getLevelConfig(this.level);
    this.targetScore = cfg.targetScore;

    // Create LevelRuntime — single source of truth for this level's runtime state
    const challengeCards = generateChallengeCards(cfg);
    this.levelRuntime = LevelRuntime.create(cfg, challengeCards, profile);

    // Create GameEventSystem instance for this level
    this.eventSystem = new GameEventSystem();

    this.handAnimator = new HandAnimator(this, DECK_PILE_X, DECK_PILE_Y);

    Logger.info(`━━━━━━━━━━ 关卡 ${this.level} [${cfg.name}] 初始化 ━━━━━━━━━━`);
    Logger.info(
      `目标分: ${cfg.targetScore}  计分次数: ${cfg.scoreChances}  ` +
      `手牌上限: ${profile.playerBuild.baseHandSize}  挑战槽: ${cfg.challengeSlotCount}  增强槽: ${profile.playerBuild.enhanceSlotCount}`,
    );

    this.eventSystem.unregisterAll();

    // Register enhance card handlers (up to enhanceSlotCount)
    profile.playerBuild.activeEnhanceCards.forEach((card, i) => {
      if (card && i < profile.playerBuild.enhanceSlotCount) {
        Logger.info(`加载增强卡 [Layer${i}]: ${card.name} (${card.id})`);
        this.eventSystem.registerAll(card.getHandlers(i, this.levelRuntime));
      }
    });

    // Register all active challenge cards
    for (const challenge of this.levelRuntime.challengeCards) {
      Logger.info(`加载挑战卡: ${challenge.name} (${challenge.id})`);
      this.eventSystem.registerAll(challenge.getHandlers(this.levelRuntime));
    }

    this.initBoard();
    this.levelRuntime.initDeck(profile.playerBuild.deck);
    this.setupCardInteraction();
    this.setupUIListeners();

    this.syncRegistry();
    this.scene.launch('UIScene');

    this.phaseManager = new PhaseManager((phase) => {
      this.registry.set('phase', phase);
      this.onPhaseEnter(phase);
    });

    this.phaseManager.transitionTo('LEVEL_START');
  }

  /**
   * 初始化棋盘 - 创建所有层的扑克牌槽、增强卡槽、权重文本、高亮矩形
   * 并创建挑战卡面板（如有）
   */
  private initBoard() {
    this.pokerSlots = [];
    this.enhanceSlots = [];
    this.boardCardObjects.clear();
    this.weightTexts = [];

    this.levelRuntime.initBoard(LAYER_SLOT_COUNTS);

    const profile = PlayerProfile.getInstance();
    const cfg = getLevelConfig(this.level);

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
          if (!slot.isOccupied) this.updateLayerHighlights();
        });

        rowSlots.push(slot);
      }
      this.pokerSlots.push(rowSlots);

      const eSlot = new BoardSlot(
        this, layout.enhanceSlot.x, layout.y, li, 0, 'enhance',
      );
      this.enhanceSlots.push(eSlot);

      const enhCardDef = profile.playerBuild.activeEnhanceCards[li];
      if (enhCardDef && li < profile.playerBuild.enhanceSlotCount) {
        new EnhanceCard(this, layout.enhanceSlot.x, layout.y, enhCardDef).setDepth(3);
      }

      const wt = this.add.text(layout.pokerSlots[0].x - 54, layout.y, '', {
        fontSize: '16px', color: '#efdc30', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setDepth(5);
      this.weightTexts.push(wt);
    }

    this.add.text(BOARD_LAYOUT.layers[0].enhanceSlot.x, BOARD_TOP_Y - 18, '增强', {
      fontSize: '11px', color: '#886633', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (this.levelRuntime.challengeCards.length > 0) {
      this.challengePanel = new ChallengeCardPanel(this, this.levelRuntime.challengeCards, 0);
    }

    this.add.text(GAME_WIDTH / 2, 18, `第 ${this.level} 关  ${cfg.name}`, {
      fontSize: '16px', color: '#ccddff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);
  }

  /**
   * 更新槽位高亮 - 根据当前选中的手牌和可放置位置，显示槽位是否可以放置
   */
  private updateLayerHighlights() {
    const rt = this.levelRuntime;
    const profile = PlayerProfile.getInstance();
    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    const preview = (this.hoverPreviewCard && !this.hoverPreviewCard.isSelected)
      ? [...selected, this.hoverPreviewCard]
      : selected;
    const canInteract = preview.length > 0 && !this.isAnimating && this.phaseManager.getPhase() === 'PLAYER_PLACING';
    const foundation = profile.foundation + rt.tempFoundationBonus;

    for (let li = 0; li < this.pokerSlots.length; li++) {
      const emptySlots = this.pokerSlots[li].filter(
        s => !s.isOccupied && !rt.disabledSlots.has(`${li}-${s.slotIndex}`),
      );
      const canPlace = canInteract
        && emptySlots.length >= preview.length
        && rt.cardsPlayedThisRound + preview.length <= rt.getEffectivePlaysPerRound();

      if (!canPlace) {
        for (const slot of this.pokerSlots[li]) {
          if (!slot.isOccupied) slot.setHighlight('normal');
        }
        continue;
      }

      const simLayers = rt.board.map(l => ({
        pokerSlots: [...l.pokerSlots],
        overrideWeight: l.overrideWeight,
      }));
      emptySlots.slice(0, preview.length).forEach((s, idx) => {
        simLayers[li].pokerSlots[s.slotIndex] = preview[idx].cardData;
      });
      const collapsed = checkCollapse(simLayers, foundation).collapsed;

      const highlight = collapsed ? 'danger' : 'hover';
      for (const slot of this.pokerSlots[li]) {
        if (!slot.isOccupied) slot.setHighlight(highlight);
      }
    }
  }

  /**
   * 层点击处理 - 选中多张手牌后点击层，自动填充空槽
   */
  private async onLayerClicked(layerIndex: number) {
    if (this.isAnimating) return;
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    const rt = this.levelRuntime;
    const playsLimit = rt.getEffectivePlaysPerRound();
    if (rt.cardsPlayedThisRound + selected.length > playsLimit) {
      Logger.warn(`出牌失败: 本轮已出 ${rt.cardsPlayedThisRound} 张，每轮最多 ${playsLimit} 张`);
      return;
    }

    const emptySlots = this.pokerSlots[layerIndex].filter(
      s => !s.isOccupied && !rt.disabledSlots.has(`${layerIndex}-${s.slotIndex}`),
    );
    if (emptySlots.length < selected.length) return;

    this.isAnimating = true;
    for (let i = 0; i < selected.length; i++) {
      await this.placeCard(selected[i], emptySlots[i]);
      const result = this.pendingCollapseResult;
      this.pendingCollapseResult = null;
      if (result) {
        await this.executeCollapse(result);
        break; // board state changed; remaining cards should not be placed
      }
    }
    if (this.collapseDepth === 0) this.isAnimating = false;
  }

  /**
   * 槽位点击处理 - 单选手牌后点击空槽，放置卡牌
   * 如果选中了多张卡，则调用 onLayerClicked 自动填充
   */
  private async onSlotClicked(slot: BoardSlot) {
    if (this.isAnimating) return;
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (slot.isOccupied) return;

    const rt = this.levelRuntime;
    if (rt.disabledSlots.has(`${slot.layerIndex}-${slot.slotIndex}`)) return;

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    if (selected.length > 1) {
      await this.onLayerClicked(slot.layerIndex);
    } else {
      const playsLimit = rt.getEffectivePlaysPerRound();
      if (rt.cardsPlayedThisRound >= playsLimit) {
        Logger.warn(`出牌失败: 本轮已出 ${rt.cardsPlayedThisRound} 张，每轮最多 ${playsLimit} 张`);
        return;
      }
      this.isAnimating = true;
      await this.placeCard(selected[0], slot);
      const result = this.pendingCollapseResult;
      this.pendingCollapseResult = null;
      if (result) {
        await this.executeCollapse(result);
      } else {
        this.isAnimating = false;
      }
    }
  }

  /**
   * 设置拖拽处理器 - 处理手牌的拖拽交互
   * 包括: hover预览、拖拽进入/离开槽位、放置卡牌
   */
  /**
   * 设置卡牌交互 - 点击选中/取消选中、悬停预览
   */
  private setupCardInteraction() {
    // 悬停预览
    this.input.on('gameobjectover', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.isAnimating) return;
      if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
      if (obj instanceof Card && obj.location === 'hand' && !obj.isSelected) {
        this.hoverPreviewCard = obj;
        this.updateLayerHighlights();
      }
    });

    this.input.on('gameobjectout', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (obj === this.hoverPreviewCard) {
        this.hoverPreviewCard = null;
        this.updateLayerHighlights();
      }
    });

    // 点击选中/取消选中
    this.input.on('gameobjectup', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.isAnimating) return;
      if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
      if (obj instanceof Card && obj.location === 'hand' && !_ptr.getDistance()) {
        obj.toggleSelect();
        this.updateLayerHighlights();
      }
    });
  }

  private setupUIListeners() {
    EventBus.on('ui:score-requested', this.onScoreRequested, this);
    EventBus.on('ui:discard-requested', this.onDiscardRequested, this);
  }

  /**
   * 放置卡牌 - 将手牌放置到棋盘槽位
   * 1. 更新卡牌状态（位置、选中状态）
   * 2. 调用 LevelRuntime.placeCard() 更新数据
   * 3. 触发 CARD_PLACED 事件
   * 4. 应用副作用
   * 5. 播放飞行动画
   */
  private async placeCard(card: Card, slot: BoardSlot, flyDelay = 0): Promise<void> {
    Logger.card('放置', `${Logger.fmtCard(card.cardData)} → Layer${slot.layerIndex} Slot${slot.slotIndex}`);

    card.location = 'board';
    card.stopFloat();
    card.isSelected = false;
    card.clearTint();
    slot.isOccupied = true;
    slot.setHighlight('normal');
    this.boardCardObjects.set(`${slot.layerIndex}-${slot.slotIndex}`, card);

    const rt = this.levelRuntime;
    const collapseResult = rt.placeCard(card.cardData, slot.layerIndex, slot.slotIndex);
    if (collapseResult) this.pendingCollapseResult = collapseResult;

    this.handAnimator.removeCard(card);
    for (const c of this.handAnimator.handCards) {
      if (c.isSelected) c.deselect();
    }
    this.handAnimator.layout();

    const layerCards = rt.board[slot.layerIndex].pokerSlots.filter(Boolean) as CardData[];
    Logger.card('当前层', `Layer${slot.layerIndex}: [${Logger.fmtCards(layerCards)}]  weight=${getLayerWeight(rt.board[slot.layerIndex])}`);

    const ges = this.eventSystem;
    const ctx = this.buildBaseContext() as CardPlacedContext;
    ctx.card = card.cardData;
    ctx.layerIndex = slot.layerIndex;
    ctx.slotIndex = slot.slotIndex;
    ges.emit(GAME_EVENTS.CARD_PLACED, ctx);

    await this.flushSideEffects(ctx);

    this.updateWeightDisplay();
    this.updateLayerHighlights();
    this.syncRegistry();

    const targetScaleX = card.scaleX * (SLOT_WIDTH / card.displayWidth);
    const targetScaleY = card.scaleY * (SLOT_HEIGHT / card.displayHeight);

    return new Promise(resolve => {
      card.setDepth(100);
      this.tweens.add({
        targets: card,
        x: slot.x,
        y: slot.y,
        angle: 0,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        duration: 280,
        delay: flyDelay,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          card.setDepth(5);
          resolve();
        },
      });
    });
  }

  /**
   * 执行坍塌 - 当牌型满足坍塌条件时触发
   * 1. 触发 COLLAPSE_TRIGGERED 事件
   * 2. 应用副作用
   * 3. 播放卡牌销毁动画
   */
  private async executeCollapse(result: CollapseResult) {
    Logger.collapse(
      `触发层: Layer${result.triggerLayerIndex}  销毁层: [${result.destroyedLayerIndices.map(i => `Layer${i}`).join(', ')}]  ` +
      `销毁卡牌: [${Logger.fmtCards(result.destroyedCards)}] (${result.destroyedCards.length} 张)`,
    );

    this.collapseDepth++;
    this.isAnimating = true;
    this.cameras.main.shake(300, 0.015);

    const ges = this.eventSystem;
    const ctx = this.buildBaseContext() as CollapseTriggeredContext;
    ctx.triggerLayerIndex = result.triggerLayerIndex;
    ctx.destroyedLayerIndices = result.destroyedLayerIndices;
    ctx.destroyedCards = result.destroyedCards;
    ges.emit(GAME_EVENTS.COLLAPSE_TRIGGERED, ctx);

    await this.flushSideEffects(ctx);

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

    await this.waitMs(500);
    this.collapseDepth--;
    if (this.collapseDepth === 0) this.isAnimating = false;
    this.updateWeightDisplay();
    this.updateLayerHighlights();
  }

  private updateWeightDisplay() {
    const rt = this.levelRuntime;
    for (let i = 0; i < rt.board.length; i++) {
      const w = getLayerWeight(rt.board[i]);
      let label = w > 0 ? `${w}` : '';
      if (rt.petrifiedSlots.has(`layer_${i}`)) label += ' ❄';
      this.weightTexts[i].setText(label);
    }
  }

  private applyVisualDeltas(deltas: VisualDelta[]) {
    const rt = this.levelRuntime;
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
          if (this.pokerSlots[d.layerIndex]?.[d.slotIndex]) {
            this.pokerSlots[d.layerIndex][d.slotIndex].isOccupied = false;
          }
          break;
        }
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
        case 'HAND_CARD_DISCARDED': {
          const extra = this.handAnimator.handCards.length - rt.hand.length;
          for (let i = 0; i < extra && i < d.count; i++) {
            const removed = this.handAnimator.handCards.pop();
            removed?.destroy();
          }
          this.handAnimator.layout();
          break;
        }
        case 'ENHANCE_DECAYED': {
          const pct = Math.round(d.multiplier * 100);
          this.showFloatText(GAME_WIDTH / 2, 80, `⚡ 增强效果: ${pct}%`, '#ff8844');
          break;
        }
      }
    }
    this.syncRegistry();
  }

  // ── Phase Handling ───────────────────────────────────────────────────────────

  /**
   * 阶段进入处理 - 根据当前阶段调用对应的处理方法
   * 阶段: LEVEL_START → PLAYER_PLACING → SCORING → LEVEL_END
   */
  private onPhaseEnter(phase: GamePhase) {
    switch (phase) {
      case 'IDLE': break;
      case 'LEVEL_START': this.onLevelStart(); break;
      case 'PLAYER_PLACING': this.onPlayerPlacing(); break;
      case 'SCORING': this.onScoring(); break;
      case 'LEVEL_END': this.onLevelEnd(); break;
    }
  }

  /**
   * LEVEL_START 阶段 - 关卡开始初始化
   * 1. 触发 LEVEL_START 事件
   * 2. 应用副作用（如调整手牌上限）
   * 3. 设置禁用槽位显示
   * 4. 摸牌
   * 5. 进入 PLAYER_PLACING 阶段
   */
  private async onLevelStart() {
    Logger.info(`━━ LEVEL_START: 关卡 ${this.level}  目标分 ${this.targetScore} ━━`);
    const ges = this.eventSystem;
    const ctx = this.buildBaseContext() as LevelStartContext;
    ctx.targetScore = this.targetScore;
    ges.emit(GAME_EVENTS.LEVEL_START, ctx);

    await this.flushSideEffects(ctx);

    this.registry.set('scoreChances', this.levelRuntime.scoreChances);

    // Apply disabled slots visually
    for (const key of this.levelRuntime.disabledSlots) {
      const [liStr, siStr] = key.split('-');
      const li = parseInt(liStr);
      const si = parseInt(siStr);
      if (this.pokerSlots[li]?.[si]) {
        this.pokerSlots[li][si].setHighlight('danger');
        this.pokerSlots[li][si].isOccupied = true;
      }
    }

    await this.fillHand();

    await this.waitMs(400);
    this.phaseManager.transitionTo('PLAYER_PLACING');
  }

  private async fillHand(exact?: number): Promise<void> {
    const rt = this.levelRuntime;
    const prevCount = this.handAnimator.handCards.length;
    const newCards = exact !== undefined
      ? rt.drawExact(exact)
      : rt.fillHand(rt.getEffectiveHandSize());
    this.registry.set('drawPileCount', rt.drawPile.length);

    const ges = this.eventSystem;

    for (const card of newCards) {
      const ctx = this.buildBaseContext() as CardDrawnContext;
      ctx.card = card;
      Logger.card('摸牌', Logger.fmtCard(card));
      ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);

      await this.flushSideEffects(ctx);
    }

    const keptCards = newCards.filter(c => rt.hand.includes(c));
    this.handAnimator.animateDraw(keptCards, prevCount);
  }

  /**
   * PLAYER_PLACING 阶段 - 玩家放置卡牌
   * 1. 清除冰冻层状态
   * 2. 启用卡牌拖拽
   * 3. 更新层高亮提示
   */
  private onPlayerPlacing() {
    Logger.info(`PLAYER_PLACING — 手牌: [${Logger.fmtCards(this.handAnimator.handCards.map(c => c.cardData))}]`);

    // Clear petrified layers at start of new placing round
    this.levelRuntime.petrifiedSlots.clear();
    this.updateWeightDisplay();

    this.updateLayerHighlights();
  }

  private onScoreRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    this.phaseManager.transitionTo('SCORING');
  }

  private async onDiscardRequested() {
    if (this.phaseManager.getPhase() !== 'PLAYER_PLACING') return;
    if (this.isAnimating) return;
    const rt = this.levelRuntime;

    const selected = this.handAnimator.handCards.filter(c => c.isSelected);
    if (selected.length === 0) return;

    const result = rt.tryDiscard(selected.map(c => c.cardData));
    if (!result.success) {
      Logger.warn(result.reason === 'no_chances'
        ? '弃牌失败: 弃牌次数已用完'
        : `弃牌失败: 每次最多弃 ${rt.getEffectiveDiscardCount()} 张`);
      return;
    }

    Logger.card('弃牌', `[${Logger.fmtCards(selected.map(c => c.cardData))}]  剩余弃牌次数: ${rt.currentDiscardChances}`);

    const ges = this.eventSystem;
    for (const card of selected) {
      const ctx = this.buildBaseContext() as CardDiscardedContext;
      ctx.card = card.cardData;
      ges.emit(GAME_EVENTS.CARD_DISCARDED, ctx);
    }

    const discardCount = selected.length;
    for (const card of selected) {
      this.handAnimator.removeCard(card);
      card.destroy();
    }

    await this.fillHand(discardCount);

    this.syncRegistry();
    this.updateLayerHighlights();
  }

  /**
   * SCORING 阶段 - 计分处理
   * 1. 触发 SCORE_START 事件
   * 2. 对所有层计分 (scoreAllLayers)
   * 3. 触发 SCORE_END 事件
   * 4. 应用副作用
   * 5. 结算本轮得分、金币
   * 6. 判断是否结束关卡或继续
   */
  private async onScoring() {
    const rt = this.levelRuntime;
    Logger.score(`━━ SCORING 开始  计分机会剩余: ${rt.scoreChances}  当前总分: ${rt.levelScore} ━━`);
    this.isAnimating = true;
    this.updateLayerHighlights();

    const ges = this.eventSystem;

    const startCtx = this.buildBaseContext() as ScoreStartContext;
    startCtx.scoreChancesRemaining = rt.scoreChances;
    ges.emit(GAME_EVENTS.SCORE_START, startCtx);

    // Apply collapse-plunder next score bonus
    const plunderBonus = rt.nextScoreFlatBonus;
    rt.nextScoreFlatBonus = 0;

    const results: LayerScoreResult[] = rt.scoreAllLayers(this.buildBaseContext(), this.eventSystem);

    const profile = PlayerProfile.getInstance();
    for (const result of results) {
      const enhEffects: string[] = [];
      const enh = profile.playerBuild.activeEnhanceCards[result.layerIndex];
      if (enh) {
        if (result.scoreMultiplier !== 1.0) enhEffects.push(`×${result.scoreMultiplier.toFixed(1)}`);
        if (result.scoreBonusFlat > 0) enhEffects.push(`+${result.scoreBonusFlat}`);
        if (result.overrideLayerWeight === 0) enhEffects.push('承重→0');
      }
      await this.playLayerScoreAnimation(result.layerIndex, result.hands, result.layerScore, enhEffects);
    }

    if (plunderBonus > 0) {
      this.showFloatText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `坍塌掠夺 +${plunderBonus}`, '#ff9900');
    }

    const { totalGained, goldEarned } = computeRoundScore(results, plunderBonus);

    const levelScoreBefore = rt.levelScore;
    const endCtx = this.buildBaseContext() as ScoreEndContext;
    endCtx.totalScoreGained = totalGained;
    endCtx.targetScore = this.targetScore;
    endCtx.levelScoreBefore = levelScoreBefore;
    endCtx.layerResults = results;
    endCtx.postLayerBonus = 0;
    endCtx.goldEarned = goldEarned;
    ges.emit(GAME_EVENTS.SCORE_END, endCtx);

    if (endCtx.postLayerBonus > 0) {
      this.showFloatText(GAME_WIDTH / 2, GAME_HEIGHT / 2, `共生契约 +${endCtx.postLayerBonus}`, '#44ffaa');
    }

    if (endCtx.goldEarned > 0) {
      this.playGoldEarnedAnimation(endCtx.goldEarned);
    }

    if (endCtx.sideEffects?.length) {
      Logger.effect(`SCORE_END sideEffects: ${JSON.stringify(endCtx.sideEffects)}`);
      await this.flushSideEffects(endCtx);
    }

    // 原子化应用本轮计分（含消耗计分机会、清除层覆盖）
    rt.applyRoundScore(totalGained, endCtx.postLayerBonus, endCtx.goldEarned);
    this.syncRegistry();

    Logger.score(`本次计分合计: +${totalGained.toFixed(1)}  累计总分: ${levelScoreBefore} → ${rt.levelScore}`);
    Logger.score(`━━ SCORING 结束  计分机会剩余: ${rt.scoreChances}  当前总分: ${rt.levelScore} ━━`);

    await this.waitMs(600);
    this.isAnimating = false;

    if (rt.shouldEndLevel(this.targetScore)) {
      if (rt.levelForceFailed) Logger.info('末日时钟：强制本关失败');
      this.phaseManager.transitionTo('LEVEL_END');
    } else {
      rt.resetRound();
      this.syncRegistry();
      await this.fillHand();
      this.phaseManager.transitionTo('PLAYER_PLACING');
    }
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

      const handLabel = hands.map(h => HAND_TYPE_LABELS[h.type] || h.type).join('+');

      const txt = this.add.text(centerX, layout.y - 50, `${handLabel} +${Math.floor(score)}`, {
        fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(50);

      if (enhEffects.length > 0) {
        const profile = PlayerProfile.getInstance();
        const enhName = profile.playerBuild.activeEnhanceCards[layerIndex]?.name ?? '';
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
    const txt = this.add.text(80, 195, `+${amount} 金币`, {
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

  private showFloatText(x: number, y: number, text: string, color: string) {
    const txt = this.add.text(x, y, text, {
      fontSize: '20px', color, fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(55);
    this.tweens.add({
      targets: txt, y: txt.y - 40, alpha: 0, duration: 1000, delay: 200,
      onComplete: () => txt.destroy(),
    });
  }

  /**
   * LEVEL_END 阶段 - 关卡结束
   * 1. 调用 LevelRuntime.concludeLevel() 计算结果
   * 2. 触发 LEVEL_END 事件
   * 3. 根据通关/失败/胜利切换场景
   */
  private async onLevelEnd() {
    const rt = this.levelRuntime;
    const profile = PlayerProfile.getInstance();

    Logger.info(`━━ LEVEL_END: 关卡 ${this.level}  得分 ${rt.levelScore} / 目标 ${this.targetScore} ━━`);

    // concludeLevel 计算结果并同步更新 PlayerProfile
    const result: LevelResult = rt.concludeLevel(this.targetScore);

    Logger.info(
      `结果: ${result.survived ? '✓ 通关' : '✗ 失败'}  新基层承重: ${result.foundationValue}` +
      (result.bonusGold > 0 ? `  奖励金币: +${result.bonusGold}` : ''),
    );

    const ges = this.eventSystem;
    const ctx = this.buildBaseContext() as LevelEndContext;
    ctx.finalScore = rt.levelScore;
    ctx.targetScore = this.targetScore;
    ctx.survived = result.survived;
    ctx.foundationValue = result.foundationValue;
    ges.emit(GAME_EVENTS.LEVEL_END, ctx);

    if (result.bonusGold > 0) {
      this.syncRegistry();
      Logger.info(`关卡通关奖励金币: +${result.bonusGold}  (共 ${profile.gold})`);
    }

    await this.waitMs(800);
    this.cleanupScene();

    if (result.survived) {
      if (result.isVictory) {
        this.scene.start('VictoryScene');
      } else {
        this.scene.start('ShopScene', { level: profile.currentLevel });
      }
    } else {
      this.scene.start('GameOverScene');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * 清理场景 - 场景结束时清理所有资源
   * 移除事件监听、销毁UI组件、清空数据
   */
  private cleanupScene() {
    // 停止背景音乐
    this.bgm?.stop();
    this.bgm = null;

    EventBus.off('ui:score-requested', this.onScoreRequested, this);
    EventBus.off('ui:discard-requested', this.onDiscardRequested, this);
    this.challengePanel?.destroy();
    this.challengePanel = null;

    this.pokerSlots = [];
    this.enhanceSlots = [];
    this.boardCardObjects.clear();
    this.handAnimator.handCards = [];
    this.weightTexts = [];

    this.scene.stop('UIScene');
    this.eventSystem.unregisterAll();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** 延时等待 - 使用 Phaser 的 delayedCall 实现异步等待 */
  private waitMs(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r));
  }

  /** 执行副作用 - 将视觉 delta 应用到渲染层，坍塌结果由调用方 await */
  private async flushSideEffects(ctx: BaseEventContext): Promise<void> {
    if (!ctx.sideEffects?.length) return;
    const { visuals, collapseResult } = this.levelRuntime.applyEffects(ctx.sideEffects);
    this.applyVisualDeltas(visuals);
    if (collapseResult) await this.executeCollapse(collapseResult);
  }

  /** 同步注册表 - 将游戏状态同步到 Phaser registry，供 UI 场景读取 */
  private syncRegistry() {
    const rt = this.levelRuntime;
    const profile = PlayerProfile.getInstance();
    this.registry.set('score', rt.levelScore);
    this.registry.set('targetScore', this.targetScore);
    this.registry.set('scoreChances', rt.scoreChances);
    this.registry.set('discardChances', rt.currentDiscardChances);
    this.registry.set('foundation', profile.foundation);
    this.registry.set('drawPileCount', rt.drawPile.length);
    this.registry.set('gold', profile.gold);
    this.registry.set('cardsPlayedThisRound', rt.cardsPlayedThisRound);
    this.registry.set('level', this.level);
  }

  /** 构建基础事件上下文 - 封装当前游戏状态，用于事件系统传递 */
  private buildBaseContext(): BaseEventContext {
    const profile = PlayerProfile.getInstance();
    const rt = this.levelRuntime;
    return {
      phase: this.phaseManager.getPhase(),
      level: this.level,
      board: rt.board.map((l, i) => ({
        index: i,
        cards: l.pokerSlots.filter(Boolean) as CardData[],
        weight: getLayerWeight(l),
        enhanceCardId: profile.playerBuild.activeEnhanceCards[i]?.id ?? null,
      })),
      gameState: {
        level: profile.currentLevel,
        score: profile.score,
        gold: profile.gold,
        foundation: profile.foundation,
        handSize: rt.getEffectiveHandSize(),
        scoreChances: rt.scoreChances,
        discardChances: rt.currentDiscardChances,
        enhanceDecayMultiplier: rt.enhanceDecayMultiplier,
        scoringRoundsElapsed: rt.scoringRoundsElapsed,
        prevLevelScore: profile.prevLevelScore,
        prevLevelTarget: profile.prevLevelTarget,
      },
    };
  }
}

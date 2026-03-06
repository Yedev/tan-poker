import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { AllEnhanceCards } from '../cards/enhance';
import { getChallengeCardsByTier, Doomsday } from '../cards/challenge';
import { EnhanceCard } from '../gameobjects/EnhanceCard';
import type { EnhanceCardDef, ChallengeCardDef } from '../types/card';
import { ENHANCE_SLOT_SIZE, BOARD_LAYOUT, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { getLevelConfig } from '../config/levels';
import { Logger } from '../utils/Logger';

const INVENTORY_SIZE = 3;

interface ShopItem {
  def: EnhanceCardDef;
  cost: number;
  discounted?: boolean;
  obj?: Phaser.GameObjects.Container;
}

export class ShopScene extends Phaser.Scene {
  private level = 1;
  private goldText!: Phaser.GameObjects.Text;

  private layerZones: Phaser.GameObjects.Zone[] = [];
  private inventoryZones: Phaser.GameObjects.Zone[] = [];

  private cardObjects: EnhanceCard[] = [];
  private shopItems: ShopItem[] = [];

  constructor() {
    super('ShopScene');
  }

  init(data: { level?: number }) {
    this.level = data.level ?? GameState.getInstance().currentLevel;
  }

  create() {
    const gs = GameState.getInstance();
    const cfg = getLevelConfig(this.level);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'game_bg');

    this.add.text(640, 40, `商  店  —  第 ${this.level} 关  ${cfg.name}`, {
      fontSize: '32px', color: '#e8d8b8', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.goldText = this.add.text(640, 85, `金币: ${gs.gold}`, {
      fontSize: '24px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(20, 20, `总分: ${gs.score}`, { fontSize: '16px', color: '#cccccc', fontFamily: 'monospace' });
    this.add.text(20, 46, `牌组: ${gs.deck.length} 张`, { fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace' });
    this.add.text(20, 72, `增强槽: ${cfg.enhanceSlotCount} 个`, { fontSize: '14px', color: '#aabbcc', fontFamily: 'monospace' });
    this.add.text(20, 94, `挑战卡: ${cfg.challengeSlotCount} 张`, { fontSize: '14px', color: '#ffaaaa', fontFamily: 'monospace' });

    // Pick challenge cards for this level
    this.setupChallengeCards(cfg.challengeSlotCount, cfg.challengePools, cfg.forceDoomsday);

    this.createLayerSlots(cfg.enhanceSlotCount);
    this.createInventorySlots();
    this.createShopItems(cfg.enhanceSlotCount > 0);
    this.setupDragEvents();

    this.refreshCards();

    // Leave button
    const btn = this.add.image(1150, 650, 'btn_shop_leave').setDisplaySize(140, 40).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xaaffaa));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => {
      gs.resetLevelState();
      gs.scoreChances = cfg.scoreChances;
      this.scene.start('BattleScene', { level: this.level });
    });
  }

  private setupChallengeCards(
    slotCount: number,
    pools: { tier: 1 | 2 | 3 | 4; count: number }[],
    forceDoomsday?: boolean,
  ) {
    const gs = GameState.getInstance();
    if (slotCount === 0) {
      gs.challengeCards = [];
      return;
    }

    const selected: ChallengeCardDef[] = [];

    // Mandatory doomsday for level 20
    if (forceDoomsday) {
      selected.push(Doomsday);
    }

    // Pick cards from each tier pool
    for (const pool of pools) {
      const tier = pool.tier;
      const poolCards = getChallengeCardsByTier(tier).filter(
        c => !selected.some(s => s.id === c.id),
      );
      const shuffled = Phaser.Math.RND.shuffle([...poolCards]);
      const picks = shuffled.slice(0, pool.count);
      selected.push(...picks);
    }

    // Trim to slot count
    const final = selected.slice(0, slotCount);
    gs.challengeCards = final;
    gs.activeChallengeIndex = 0;

    Logger.info(`[ShopScene] 关${this.level} 挑战卡 (${final.length}张): ${final.map(c => c.name).join(', ')}`);

    // Show challenge card info on screen
    if (final.length > 0) {
      const startY = 120;
      this.add.text(GAME_WIDTH - 20, startY - 20, '本关挑战卡', {
        fontSize: '14px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(1, 0.5);

      final.forEach((card, i) => {
        this.add.text(GAME_WIDTH - 20, startY + i * 40, `⚡ ${card.name}`, {
          fontSize: '13px', color: '#ffaaaa', fontFamily: 'monospace',
        }).setOrigin(1, 0);
        this.add.text(GAME_WIDTH - 20, startY + i * 40 + 16, card.description, {
          fontSize: '11px', color: '#996666', fontFamily: 'monospace',
          wordWrap: { width: 280, useAdvancedWrap: false },
        }).setOrigin(1, 0);
      });
    }
  }

  private createLayerSlots(enhanceSlotCount: number) {
    const totalLayers = BOARD_LAYOUT.layers.length;
    this.add.text(640, 130, `已装备增强（拖拽调整层，共${enhanceSlotCount}槽）`, {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const slotSpacing = Math.min(160, 640 / Math.max(1, totalLayers));
    const totalWidth = (totalLayers - 1) * slotSpacing;
    const startX = 640 - totalWidth / 2;

    for (let i = 0; i < totalLayers; i++) {
      const x = startX + i * slotSpacing;
      const y = 210;
      const isActive = i < enhanceSlotCount;

      this.add.image(x, y, 'enhance_slot_bg')
        .setDisplaySize(ENHANCE_SLOT_SIZE, ENHANCE_SLOT_SIZE)
        .setAlpha(isActive ? 1.0 : 0.3);
      this.add.text(x, y + 42, isActive ? `第 ${i} 层` : '锁', {
        fontSize: '13px', color: isActive ? '#888888' : '#555555',
      }).setOrigin(0.5);

      const zone = this.add.zone(x, y, ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20)
        .setRectangleDropZone(ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20);
      zone.setData('type', 'layer');
      zone.setData('index', i);
      zone.setData('active', isActive);
      this.layerZones.push(zone);
    }
  }

  private createInventorySlots() {
    this.add.text(640, 300, '备用增强（最多3个）', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
    }).setOrigin(0.5);
    const startX = 640 - 150;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const x = startX + i * 150;
      const y = 375;

      this.add.image(x, y, 'enhance_slot_bg').setDisplaySize(ENHANCE_SLOT_SIZE, ENHANCE_SLOT_SIZE);

      const zone = this.add.zone(x, y, ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20)
        .setRectangleDropZone(ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20);
      zone.setData('type', 'inventory');
      zone.setData('index', i);
      this.inventoryZones.push(zone);
    }
  }

  private createShopItems(shopOpen: boolean) {
    if (!shopOpen) {
      this.add.text(640, 490, '增强商店（解锁于第2关）', {
        fontSize: '18px', color: '#666666', fontFamily: 'sans-serif',
      }).setOrigin(0.5);
      return;
    }

    this.add.text(640, 460, '出售的增强牌', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const gs = GameState.getInstance();
    const hasBlackMarket = (gs as any).blackMarketDiscount === true;
    if (hasBlackMarket) {
      (gs as any).blackMarketDiscount = false;
    }

    // Pick up to 3 cards not already owned
    const owned = new Set([
      ...gs.enhanceSlots.filter(Boolean).map(c => c!.id),
      ...gs.enhanceInventory.map(c => c.id),
    ]);
    const available = AllEnhanceCards.filter(c => !owned.has(c.id));
    const shuffled = Phaser.Math.RND.shuffle([...available]);
    const picks = shuffled.slice(0, Math.min(3, available.length));

    const discountIdx = hasBlackMarket && picks.length > 0
      ? Math.floor(Math.random() * picks.length)
      : -1;

    this.shopItems = picks.map((def, i) => {
      const baseCost = 30 + Math.floor(Math.random() * 50);
      const discounted = i === discountIdx;
      return { def, cost: discounted ? Math.floor(baseCost * 0.5) : baseCost, discounted };
    });

    const startX = 640 - (picks.length - 1) * 100;
    this.shopItems.forEach((item, i) => {
      const x = startX + i * 200;
      const y = 555;

      const container = this.add.container(x, y);
      item.obj = container;

      const card = new EnhanceCard(this, 0, 0, item.def);
      container.add(card);

      const bgWidth = 140;
      const bgHeight = 30;
      const btnColor = item.discounted ? 0x44cc88 : 0xffcc44;
      const btnBg = this.add.rectangle(0, 60, bgWidth, bgHeight, btnColor).setInteractive({ useHandCursor: true });
      const label = item.discounted ? `${item.cost} 金 (半价!)` : `购买: ${item.cost} 金`;
      const btnText = this.add.text(0, 60, label, {
        fontSize: '13px', color: '#000000', fontFamily: 'sans-serif', fontStyle: 'bold',
      }).setOrigin(0.5);

      container.add([btnBg, btnText]);

      btnBg.on('pointerover', () => btnBg.setFillStyle(item.discounted ? 0x88ffbb : 0xffdd88));
      btnBg.on('pointerout', () => btnBg.setFillStyle(btnColor));
      btnBg.on('pointerup', () => this.buyItem(i));
    });
  }

  private buyItem(index: number) {
    const item = this.shopItems[index];
    if (!item || !item.obj) return;

    const gs = GameState.getInstance();
    if (gs.gold < item.cost) {
      Logger.warn('金币不足');
      this.cameras.main.shake(200, 0.005);
      return;
    }

    if (gs.enhanceInventory.length >= INVENTORY_SIZE) {
      Logger.warn('备用栏已满');
      this.cameras.main.shake(200, 0.005);
      return;
    }

    gs.gold -= item.cost;
    this.goldText.setText(`金币: ${gs.gold}`);

    gs.enhanceInventory.push(item.def);
    Logger.info(`购买增强卡: ${item.def.name}  花费 ${item.cost} 金 (剩余 ${gs.gold})`);

    item.obj.destroy();
    this.shopItems[index].obj = undefined;

    this.refreshCards();
  }

  private refreshCards() {
    this.cardObjects.forEach(c => c.destroy());
    this.cardObjects = [];

    const gs = GameState.getInstance();

    gs.enhanceSlots.forEach((def, i) => {
      if (def) {
        const zone = this.layerZones[i];
        if (!zone) return;
        const card = new EnhanceCard(this, zone.x, zone.y, def);
        card.setData('sourceType', 'layer');
        card.setData('sourceIndex', i);
        this.input.setDraggable(card);
        this.cardObjects.push(card);
      }
    });

    gs.enhanceInventory.forEach((def, i) => {
      if (def) {
        const zone = this.inventoryZones[i];
        if (!zone) return;
        const card = new EnhanceCard(this, zone.x, zone.y, def);
        card.setData('sourceType', 'inventory');
        card.setData('sourceIndex', i);
        this.input.setDraggable(card);
        this.cardObjects.push(card);
      }
    });
  }

  private setupDragEvents() {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: EnhanceCard) => {
      gameObject.setDepth(100);
      gameObject.setScale(1.1);
    });

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dragX: number, dragY: number) => {
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on('drop', (_pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dropZone: Phaser.GameObjects.Zone) => {
      gameObject.setScale(1);
      gameObject.setDepth(3);

      const sourceType = gameObject.getData('sourceType');
      const sourceIndex = gameObject.getData('sourceIndex');

      const targetType = dropZone.getData('type');
      const targetIndex = dropZone.getData('index');

      // Prevent dropping into locked layer slots
      if (targetType === 'layer' && !dropZone.getData('active')) {
        this.refreshCards();
        return;
      }

      const gs = GameState.getInstance();

      const sourceDef: EnhanceCardDef | null = sourceType === 'layer'
        ? gs.enhanceSlots[sourceIndex]
        : (gs.enhanceInventory[sourceIndex] || null);
      const targetDef: EnhanceCardDef | null = targetType === 'layer'
        ? gs.enhanceSlots[targetIndex]
        : (gs.enhanceInventory[targetIndex] || null);

      const newInventory: (EnhanceCardDef | null)[] = [...gs.enhanceInventory];

      if (sourceType === 'layer') {
        gs.enhanceSlots[sourceIndex] = targetDef;
      } else {
        newInventory[sourceIndex] = targetDef;
      }

      if (targetType === 'layer') {
        gs.enhanceSlots[targetIndex] = sourceDef;
      } else {
        newInventory[targetIndex] = sourceDef;
      }

      gs.enhanceInventory = newInventory.filter((x): x is EnhanceCardDef => x !== null);

      this.refreshCards();
    });

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dropped: boolean) => {
      if (!dropped) {
        gameObject.setScale(1);
        gameObject.setDepth(3);
        this.refreshCards();
      }
    });
  }
}

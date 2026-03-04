import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { AllEnhanceCards } from '../cards/enhance';
import { EnhanceCard } from '../gameobjects/EnhanceCard';
import type { EnhanceCardDef } from '../types/card';
import { ENHANCE_SLOT_SIZE, BOARD_LAYOUT, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Logger } from '../utils/Logger';

const INVENTORY_SIZE = 3;

interface ShopItem {
  def: EnhanceCardDef;
  cost: number;
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
    
    // Title
    this.add.text(640, 40, '商 店', {
      fontSize: '40px', color: '#e8d8b8', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.goldText = this.add.text(640, 85, `金币: ${gs.gold}`, {
      fontSize: '24px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Some status info
    this.add.text(20, 20, `第 ${this.level} 关准备`, { fontSize: '18px', color: '#8899aa', fontFamily: 'monospace' });
    this.add.text(20, 50, `总分: ${gs.score}`, { fontSize: '16px', color: '#cccccc', fontFamily: 'monospace' });
    this.add.text(20, 80, `牌组: ${gs.deck.length} 张`, { fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace' });

    this.createLayerSlots();
    this.createInventorySlots();
    this.createShopItems();
    this.setupDragEvents();
    
    this.refreshCards();

    // Leave button
    const btn = this.add.image(1150, 650, 'btn_shop_leave').setDisplaySize(140, 40).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xaaffaa));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => {
      gs.resetRound();
      this.scene.start('BattleScene', { level: this.level });
    });

    this.scale.on('resize', this.applyResponsiveScale, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyResponsiveScale, this));
    this.applyResponsiveScale();
  }

  private applyResponsiveScale() {
    if (!this.cameras?.main) return;
    const dpr = Math.round(window.devicePixelRatio || 1);
    this.cameras.main.setZoom(dpr);
    this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  private createLayerSlots() {
    const layerCount = BOARD_LAYOUT.layers.length;
    this.add.text(640, 140, '已装备增强 (拖拽调整层)', { fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif' }).setOrigin(0.5);
    const slotSpacing = Math.min(150, 560 / layerCount);
    const totalWidth = (layerCount - 1) * slotSpacing;
    const startX = 640 - totalWidth / 2;
    for (let i = 0; i < layerCount; i++) {
      const x = startX + i * slotSpacing;
      const y = 210;

      this.add.image(x, y, 'enhance_slot_bg').setDisplaySize(ENHANCE_SLOT_SIZE, ENHANCE_SLOT_SIZE);
      this.add.text(x, y + 45, `第 ${i} 层`, { fontSize: '14px', color: '#888888' }).setOrigin(0.5);

      const zone = this.add.zone(x, y, ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20).setRectangleDropZone(ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20);
      zone.setData('type', 'layer');
      zone.setData('index', i);
      this.layerZones.push(zone);
    }
  }

  private createInventorySlots() {
    this.add.text(640, 310, '备用增强 (最多3个)', { fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif' }).setOrigin(0.5);
    const startX = 640 - 150;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const x = startX + i * 150;
      const y = 380;
      
      this.add.image(x, y, 'enhance_slot_bg').setDisplaySize(ENHANCE_SLOT_SIZE, ENHANCE_SLOT_SIZE);
      
      const zone = this.add.zone(x, y, ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20).setRectangleDropZone(ENHANCE_SLOT_SIZE + 20, ENHANCE_SLOT_SIZE + 20);
      zone.setData('type', 'inventory');
      zone.setData('index', i);
      this.inventoryZones.push(zone);
    }
  }

  private createShopItems() {
    this.add.text(640, 480, '出售的增强牌', { fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif' }).setOrigin(0.5);
    
    // Pick 3 random cards for sale
    const shuffled = Phaser.Math.RND.shuffle([...AllEnhanceCards]);
    this.shopItems = shuffled.slice(0, 3).map(def => ({ def, cost: Phaser.Math.Between(30, 80) }));
    
    const startX = 640 - 200;
    this.shopItems.forEach((item, i) => {
      const x = startX + i * 200;
      const y = 560;
      
      const container = this.add.container(x, y);
      item.obj = container;
      
      const card = new EnhanceCard(this, 0, 0, item.def);
      container.add(card);
      
      const bgWidth = 120;
      const bgHeight = 30;
      const btnBg = this.add.rectangle(0, 60, bgWidth, bgHeight, 0xffcc44).setInteractive({ useHandCursor: true });
      const btnText = this.add.text(0, 60, `购买: ${item.cost} 金币`, {
        fontSize: '14px', color: '#000000', fontFamily: 'sans-serif', fontStyle: 'bold'
      }).setOrigin(0.5);
      
      container.add([btnBg, btnText]);
      
      btnBg.on('pointerover', () => btnBg.setFillStyle(0xffdd88));
      btnBg.on('pointerout', () => btnBg.setFillStyle(0xffcc44));
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
    
    item.obj.destroy();
    this.shopItems[index].obj = undefined;
    
    this.refreshCards();
  }

  private refreshCards() {
    this.cardObjects.forEach(c => c.destroy());
    this.cardObjects = [];
    
    const gs = GameState.getInstance();
    
    // Draw layer cards
    gs.enhanceSlots.forEach((def, i) => {
      if (def) {
        const zone = this.layerZones[i];
        const card = new EnhanceCard(this, zone.x, zone.y, def);
        card.setData('sourceType', 'layer');
        card.setData('sourceIndex', i);
        this.input.setDraggable(card);
        this.cardObjects.push(card);
      }
    });
    
    // Draw inventory cards
    gs.enhanceInventory.forEach((def, i) => {
      if (def) {
        const zone = this.inventoryZones[i];
        const card = new EnhanceCard(this, zone.x, zone.y, def);
        card.setData('sourceType', 'inventory');
        card.setData('sourceIndex', i);
        this.input.setDraggable(card);
        this.cardObjects.push(card);
      }
    });
  }

  private setupDragEvents() {
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: EnhanceCard) => {
      gameObject.setDepth(100);
      gameObject.setScale(1.1);
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dragX: number, dragY: number) => {
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on('drop', (pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dropZone: Phaser.GameObjects.Zone) => {
      gameObject.setScale(1);
      gameObject.setDepth(3);
      
      const sourceType = gameObject.getData('sourceType');
      const sourceIndex = gameObject.getData('sourceIndex');
      
      const targetType = dropZone.getData('type');
      const targetIndex = dropZone.getData('index');
      
      const gs = GameState.getInstance();
      
      let sourceDef: EnhanceCardDef | null = sourceType === 'layer' ? gs.enhanceSlots[sourceIndex] : gs.enhanceInventory[sourceIndex];
      let targetDef: EnhanceCardDef | null = targetType === 'layer' ? gs.enhanceSlots[targetIndex] : (gs.enhanceInventory[targetIndex] || null);
      
      let newInventory: (EnhanceCardDef | null)[] = [...gs.enhanceInventory];
      
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

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: EnhanceCard, dropped: boolean) => {
      if (!dropped) {
        gameObject.setScale(1);
        gameObject.setDepth(3);
        this.refreshCards(); // reset pos to original
      }
    });
  }
}

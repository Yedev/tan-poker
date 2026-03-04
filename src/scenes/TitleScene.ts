import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { createDeck } from '../logic/deck';
import { StraightFever } from '../cards/enhance/StraightFever';
import { RoyalExclusive } from '../cards/enhance/RoyalExclusive';
import { HollowBrick } from '../cards/enhance/HollowBrick';
import { CARD_WIDTH, CARD_HEIGHT, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    this.add.text(640, 200, '叠 牌', {
      fontSize: '72px', color: '#e8d8b8', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.add.text(640, 280, 'Stacking Cards', {
      fontSize: '24px', color: '#8899aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(640, 340, '卡牌构筑 · Roguelike · 物理叠塔', {
      fontSize: '16px', color: '#6a7a8a', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const btn = this.add.image(640, 450, 'btn_start').setDisplaySize(160, 50).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xccccff));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => {
      const gs = GameState.getInstance();
      gs.reset();
      gs.deck = createDeck();
      gs.enhanceSlots = [StraightFever, RoyalExclusive, HollowBrick];
      this.scene.start('BattleScene', { level: 1 });
    });

    const demoCards = [
      { suit: 'spades', rank: 14 },
      { suit: 'hearts', rank: 13 },
      { suit: 'diamonds', rank: 12 },
      { suit: 'clubs', rank: 11 },
      { suit: 'hearts', rank: 10 },
    ];
    demoCards.forEach((c, i) => {
      const x = 440 + i * 80;
      const img = this.add.image(x, 560, `card_${c.suit}_${c.rank}`);
      img.setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
      img.setAngle(-10 + i * 5);
      img.setAlpha(0.6);
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
}

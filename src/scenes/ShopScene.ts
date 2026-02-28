import Phaser from 'phaser';
import { GameState } from '../state/GameState';

export class ShopScene extends Phaser.Scene {
  private level = 1;

  constructor() {
    super('ShopScene');
  }

  init(data: { level?: number }) {
    this.level = data.level ?? GameState.getInstance().currentLevel;
  }

  create() {
    const gs = GameState.getInstance();

    this.add.text(640, 60, '商 店', {
      fontSize: '40px', color: '#e8d8b8', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.add.text(640, 120, `第 ${this.level} 关准备`, {
      fontSize: '20px', color: '#8899aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(200, 200, `总分: ${gs.score}`, {
      fontSize: '18px', color: '#cccccc', fontFamily: 'monospace',
    });
    this.add.text(200, 230, `金币: ${gs.gold}`, {
      fontSize: '18px', color: '#ffdd88', fontFamily: 'monospace',
    });
    this.add.text(200, 260, `基层承重: ${gs.foundation === Infinity ? '∞' : gs.foundation}`, {
      fontSize: '18px', color: '#88aacc', fontFamily: 'monospace',
    });
    this.add.text(200, 290, `牌组: ${gs.deck.length} 张`, {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'monospace',
    });

    this.add.text(640, 380, '(商店功能开发中)', {
      fontSize: '16px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const btn = this.add.image(640, 500, 'btn_shop_leave').setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xaaffaa));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => {
      gs.resetRound();
      this.scene.start('BattleScene', { level: this.level });
    });
  }
}

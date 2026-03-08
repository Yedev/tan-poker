import Phaser from 'phaser';
import { PlayerProfile } from '../state/PlayerProfile';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'game_bg');

    const gs = PlayerProfile.getInstance();

    this.add.text(640, 200, '游戏结束', {
      fontSize: '56px', color: '#cc4444', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.add.text(640, 300, `到达第 ${gs.currentLevel} 关`, {
      fontSize: '24px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(640, 340, `总分: ${gs.score}`, {
      fontSize: '20px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const btn = this.add.image(640, 460, 'btn_restart').setDisplaySize(140, 40).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xffaaaa));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => this.scene.start('TitleScene'));

  }
}

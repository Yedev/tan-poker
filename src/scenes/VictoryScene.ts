import Phaser from 'phaser';
import { PlayerProfile } from '../state/PlayerProfile';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'game_bg');

    const gs = PlayerProfile.getInstance();

    this.add.text(640, 200, '🎉 胜利！', {
      fontSize: '56px', color: '#44cc44', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.add.text(640, 300, `通关第 ${gs.currentLevel} 关`, {
      fontSize: '24px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(640, 340, `总分: ${gs.score}`, {
      fontSize: '20px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const btn = this.add.image(640, 460, 'btn_restart').setDisplaySize(140, 40).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setTint(0xaaffaa));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => this.scene.start('TitleScene'));

  }
}

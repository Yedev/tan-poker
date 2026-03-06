import Phaser from 'phaser';
import type { ChallengeCardDef } from '../types/card';

/** Individual challenge card visual — draws itself with Graphics (no texture dep). */
export class ChallengeCard extends Phaser.GameObjects.Container {
  public cardDef: ChallengeCardDef;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cardDef: ChallengeCardDef,
    width: number,
    height: number,
    isActive: boolean,
  ) {
    super(scene, x, y);
    this.cardDef = cardDef;

    const bg = scene.add.graphics();

    if (isActive) {
      bg.fillStyle(0x4a1212, 0.97);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
      bg.lineStyle(2, 0xdd4444, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
      bg.lineStyle(1, 0xff7777, 0.22);
      bg.strokeRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 7);
    } else {
      bg.fillStyle(0x220a0a, 0.9);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 7);
      bg.lineStyle(1.5, 0x662222, 0.75);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 7);
      bg.lineStyle(0.5, 0x441111, 0.4);
      bg.strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 4);
    }
    this.add(bg);

    if (isActive) {
      this.add(scene.add.text(0, -height / 2 + 10, cardDef.name, {
        fontSize: '12px', color: '#ffaaaa', fontStyle: 'bold',
        fontFamily: 'sans-serif', align: 'center',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: width - 12 },
      }).setOrigin(0.5, 0));

      this.add(scene.add.text(0, -6, '⚠', {
        fontSize: '28px', color: '#ff5555',
      }).setOrigin(0.5));

      const status = scene.add.text(0, height / 2 - 13, '● 生效中', {
        fontSize: '10px', color: '#ff8888', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5);
      this.add(status);

      scene.tweens.add({
        targets: status, alpha: 0.4, duration: 700,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    this.setSize(width, height);
    scene.add.existing(this);
  }
}

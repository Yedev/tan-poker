import Phaser from 'phaser';
import type { ChallengeCardDef } from '../types/card';
import { CARD_WIDTH, CARD_HEIGHT } from '../config';

export class ChallengeCard extends Phaser.GameObjects.Container {
  public cardDef: ChallengeCardDef;

  constructor(scene: Phaser.Scene, x: number, y: number, cardDef: ChallengeCardDef) {
    super(scene, x, y);
    this.cardDef = cardDef;

    // Background image
    const bg = scene.add.image(0, 0, 'challenge_bg');
    bg.setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
    this.add(bg);

    // Text label
    const text = scene.add.text(0, 0, cardDef.name, {
      fontSize: '12px', color: '#ffaaaa', fontFamily: 'sans-serif',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(text);

    // Interactivity
    this.setSize(CARD_WIDTH, CARD_HEIGHT);
    this.setInteractive({ useHandCursor: true });
    
    // Simple hover effect
    this.on('pointerover', () => {
      this.setScale(1.1);
      this.setDepth(100);
    });
    this.on('pointerout', () => {
      this.setScale(1);
      this.setDepth(3);
    });

    scene.add.existing(this);
  }
}

import Phaser from 'phaser';
import type { CardData } from '../types/card';
import { HAND_CARD_WIDTH, HAND_CARD_HEIGHT } from '../config';

export class Card extends Phaser.GameObjects.Image {
  public cardData: CardData;
  public isSelected = false;
  public originalX = 0;
  public originalY = 0;
  public originalAngle = 0;
  /** Per-card random angle offset assigned once on draw, persists across re-layouts. */
  public angleJitter = 0;
  public location: 'hand' | 'board' | 'discard' = 'hand';
  public homeDepth = 10;
  private floatTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData) {
    super(scene, x, y, `card_${cardData.suit}_${cardData.rank}`);
    this.cardData = cardData;
    this.originalX = x;
    this.originalY = y;

    this.setDisplaySize(HAND_CARD_WIDTH, HAND_CARD_HEIGHT);
    this.setInteractive({ useHandCursor: true, draggable: false });
    scene.add.existing(this);

    this.on('pointerover', () => {
      if (this.location !== 'hand' || this.isSelected) return;
      this.stopFloat();
      this.y = this.originalY - 10;
    });
    this.on('pointerout', () => {
      if (this.location !== 'hand' || this.isSelected) return;
      this.y = this.originalY;
      this.startFloat();
    });
  }

  enableDrag(): void {
    this.scene.input.setDraggable(this, true);
  }

  disableDrag(): void {
    this.scene.input.setDraggable(this, false);
  }

  select(): void {
    this.isSelected = true;
    this.stopFloat();
    this.y = this.originalY - 35;
  }

  deselect(): void {
    this.isSelected = false;
    this.y = this.originalY;
    this.startFloat();
  }

  toggleSelect(): void {
    if (this.isSelected) this.deselect();
    else this.select();
  }

  setHome(x: number, y: number, angle = 0): void {
    this.originalX = x;
    this.originalY = y;
    this.originalAngle = angle;
  }

  returnHome(): void {
    this.x = this.originalX;
    this.y = this.originalY;
    this.setAngle(this.originalAngle);
    this.startFloat();
  }

  startFloat(delay = 0): void {
    this.stopFloat();
    const baseY = this.originalY;
    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: baseY - 2,
      duration: 900,
      delay,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  stopFloat(): void {
    if (this.floatTween) {
      this.floatTween.stop();
      this.floatTween = undefined;
      this.y = this.originalY;
    }
  }
}

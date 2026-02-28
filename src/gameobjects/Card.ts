import Phaser from 'phaser';
import type { CardData } from '../types/card';

export class Card extends Phaser.GameObjects.Image {
  public cardData: CardData;
  public isSelected = false;
  public originalX = 0;
  public originalY = 0;
  public originalAngle = 0;
  /** Per-card random angle offset assigned once on draw, persists across re-layouts. */
  public angleJitter = 0;
  public location: 'hand' | 'board' | 'discard' = 'hand';

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData) {
    super(scene, x, y, `card_${cardData.suit}_${cardData.rank}`);
    this.cardData = cardData;
    this.originalX = x;
    this.originalY = y;

    this.setInteractive({ useHandCursor: true, draggable: false });
    scene.add.existing(this);
  }

  enableDrag(): void {
    this.scene.input.setDraggable(this, true);
  }

  disableDrag(): void {
    this.scene.input.setDraggable(this, false);
  }

  select(): void {
    this.isSelected = true;
    this.setTint(0x8888ff);
    this.y = this.originalY - 20;
    this.setAngle(0); // straighten when lifted
  }

  deselect(): void {
    this.isSelected = false;
    this.clearTint();
    this.y = this.originalY;
    this.setAngle(this.originalAngle);
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
  }
}

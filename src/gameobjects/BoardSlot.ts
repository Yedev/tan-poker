import Phaser from 'phaser';

export class BoardSlot {
  public layerIndex: number;
  public slotIndex: number;
  public slotType: 'poker' | 'enhance';
  public isOccupied = false;
  public zone: Phaser.GameObjects.Zone;
  public bg: Phaser.GameObjects.Image;
  public x: number;
  public y: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    layerIndex: number,
    slotIndex: number,
    slotType: 'poker' | 'enhance' = 'poker',
  ) {
    this.x = x;
    this.y = y;
    this.layerIndex = layerIndex;
    this.slotIndex = slotIndex;
    this.slotType = slotType;

    const texKey = slotType === 'poker' ? 'slot_bg' : 'enhance_slot_bg';
    this.bg = scene.add.image(x, y, texKey).setDepth(0);

    const w = slotType === 'poker' ? 72 : 52;
    const h = slotType === 'poker' ? 98 : 52;
    this.zone = scene.add.zone(x, y, w, h).setRectangleDropZone(w, h);
    this.zone.setData('boardSlot', this);
  }

  setHighlight(state: 'normal' | 'hover' | 'danger'): void {
    switch (state) {
      case 'normal':
        this.bg.setTexture(this.slotType === 'poker' ? 'slot_bg' : 'enhance_slot_bg');
        break;
      case 'hover':
        this.bg.setTexture('slot_hover');
        break;
      case 'danger':
        this.bg.setTexture('slot_danger');
        break;
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.zone.destroy();
  }
}

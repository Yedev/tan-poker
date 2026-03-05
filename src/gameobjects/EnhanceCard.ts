import Phaser from 'phaser';
import type { EnhanceCardDef } from '../types/card';
import { CARD_WIDTH, CARD_HEIGHT } from '../config';

const TOOLTIP_W = 180;
const TOOLTIP_PAD = 8;

export class EnhanceCard extends Phaser.GameObjects.Container {
  public cardDef: EnhanceCardDef;

  constructor(scene: Phaser.Scene, x: number, y: number, cardDef: EnhanceCardDef) {
    super(scene, x, y);
    this.cardDef = cardDef;

    // Background image
    const bg = scene.add.image(0, 0, 'enhance_bg');
    bg.setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
    this.add(bg);

    // Text label
    const text = scene.add.text(0, 0, cardDef.name, {
      fontSize: '12px', color: '#ddcc88', fontFamily: 'sans-serif',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(text);

    // ── Tooltip (scene-level so it renders above everything) ──
    const nameText = scene.add.text(0, 0, cardDef.name, {
      fontSize: '13px', color: '#ffdd88', fontFamily: 'sans-serif',
      fontStyle: 'bold',
      wordWrap: { width: TOOLTIP_W - TOOLTIP_PAD * 2 },
    }).setOrigin(0, 0).setDepth(201);

    const descText = scene.add.text(0, 0, cardDef.description, {
      fontSize: '11px', color: '#cccccc', fontFamily: 'sans-serif',
      wordWrap: { width: TOOLTIP_W - TOOLTIP_PAD * 2 },
    }).setOrigin(0, 0).setDepth(201);

    const tooltipH = nameText.height + descText.height + TOOLTIP_PAD * 3;
    const tooltipBg = scene.add.rectangle(0, 0, TOOLTIP_W, tooltipH, 0x111111, 0.92)
      .setStrokeStyle(1, 0x886633, 1)
      .setDepth(200);

    const tooltip = [tooltipBg, nameText, descText];
    tooltip.forEach(o => o.setAlpha(0));

    const showTooltip = () => {
      // Position tooltip above the card, clamped to canvas top
      const tx = x;
      const ty = Math.max(tooltipH / 2 + 4, y - CARD_HEIGHT / 2 - tooltipH / 2 - 6);
      tooltipBg.setPosition(tx, ty);
      nameText.setPosition(tx - TOOLTIP_W / 2 + TOOLTIP_PAD, ty - tooltipH / 2 + TOOLTIP_PAD);
      descText.setPosition(tx - TOOLTIP_W / 2 + TOOLTIP_PAD, ty - tooltipH / 2 + TOOLTIP_PAD + nameText.height + 4);
      tooltip.forEach(o => o.setAlpha(1));
      this.setScale(1.05);
      this.setDepth(100);
    };

    const hideTooltip = () => {
      tooltip.forEach(o => o.setAlpha(0));
      this.setScale(1);
      this.setDepth(3);
    };

    // Clean up tooltip objects when the card is destroyed
    this.on('destroy', () => tooltip.forEach(o => o.destroy()));

    // Interactivity
    this.setSize(CARD_WIDTH, CARD_HEIGHT);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', showTooltip);
    this.on('pointerout', hideTooltip);

    scene.add.existing(this);
  }
}

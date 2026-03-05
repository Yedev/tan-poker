import Phaser from 'phaser';
import {
  CARD_WIDTH, CARD_HEIGHT, SLOT_WIDTH, SLOT_HEIGHT, ENHANCE_SLOT_SIZE,
  SUITS, SUIT_SYMBOLS, SUIT_COLORS, RANK_LABELS,
} from '../config';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeSlotTexture(scene: Phaser.Scene, key: string, w: number, h: number, border: string, fill: string) {
  const ct = scene.textures.createCanvas(key, w, h)!;
  const ctx = ct.getContext();
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.25;
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  roundRect(ctx, 2, 2, w - 4, h - 4, 5);
  ctx.stroke();
  ct.refresh();
}

function makeButtonTexture(scene: Phaser.Scene, key: string, w: number, h: number, bg: string, label: string) {
  const ct = scene.textures.createCanvas(key, w, h)!;
  const ctx = ct.getContext();
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  roundRect(ctx, 1, 1, w - 2, h - 2, 5);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);
  ct.refresh();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.text(640, 340, '叠牌 · Loading...', {
      fontSize: '28px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.generateAllTextures();

    this.time.delayedCall(300, () => {
      this.scene.start('PreloadScene');
    });
  }

  private generateAllTextures() {
    const W = CARD_WIDTH;
    const H = CARD_HEIGHT;
    // Draw card textures at 2× so they stay sharp when scaled up in hand
    const TX = 2;

    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank++) {
        const key = `card_${suit}_${rank}`;
        const ct = this.textures.createCanvas(key, W * TX, H * TX)!;
        const ctx = ct.getContext();
        ctx.scale(TX, TX);
        const isRed = suit === 'hearts' || suit === 'diamonds';
        const color = SUIT_COLORS[suit];

        ctx.fillStyle = '#f5f0e1';
        roundRect(ctx, 0, 0, W, H, 4);
        ctx.fill();
        ctx.strokeStyle = isRed ? '#aa3333' : '#333333';
        ctx.lineWidth = 1.5;
        roundRect(ctx, 1, 1, W - 2, H - 2, 3);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(RANK_LABELS[rank], 4, 3);

        ctx.font = '12px serif';
        ctx.fillText(SUIT_SYMBOLS[suit], 4, 19);

        ctx.font = '26px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SUIT_SYMBOLS[suit], W / 2, H / 2 + 4);

        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(RANK_LABELS[rank] + SUIT_SYMBOLS[suit], W - 3, H - 3);

        ct.refresh();
      }
    }

    {
      const ct = this.textures.createCanvas('card_back', W * TX, H * TX)!;
      const ctx = ct.getContext();
      ctx.scale(TX, TX);
      ctx.fillStyle = '#2a4858';
      roundRect(ctx, 0, 0, W, H, 4);
      ctx.fill();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 2;
      roundRect(ctx, 3, 3, W - 6, H - 6, 3);
      ctx.stroke();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 1;
      roundRect(ctx, 7, 7, W - 14, H - 14, 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 6; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillStyle = '#3a5868';
            ctx.fillRect(12 + i * 10, 12 + j * 11, 8, 9);
          }
        }
      }
      ct.refresh();
    }

    makeSlotTexture(this, 'slot_bg', SLOT_WIDTH, SLOT_HEIGHT, '#5a6a7a', '#3a4a5a');
    makeSlotTexture(this, 'slot_hover', SLOT_WIDTH, SLOT_HEIGHT, '#5a9aba', '#3a6a8a');
    makeSlotTexture(this, 'slot_danger', SLOT_WIDTH, SLOT_HEIGHT, '#ba5a5a', '#8a3a3a');
    makeSlotTexture(this, 'enhance_slot_bg', ENHANCE_SLOT_SIZE, ENHANCE_SLOT_SIZE, '#8a7a4a', '#5a4a2a');

    makeButtonTexture(this, 'btn_score', 110, 40, '#2a6a2a', '计分');
    makeButtonTexture(this, 'btn_discard', 110, 40, '#6a3a2a', '弃牌');
    makeButtonTexture(this, 'btn_start', 160, 50, '#3a3a8a', '开始游戏');
    makeButtonTexture(this, 'btn_continue', 140, 40, '#3a6a3a', '继续');
    makeButtonTexture(this, 'btn_restart', 140, 40, '#6a3a3a', '重新开始');
    makeButtonTexture(this, 'btn_shop_leave', 140, 40, '#3a5a6a', '下一关');

    {
      const ct = this.textures.createCanvas('particle_spark', 8, 8)!;
      const ctx = ct.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ct.refresh();
    }

    {
      const ct = this.textures.createCanvas('weight_icon', 20, 20)!;
      const ctx = ct.getContext();
      ctx.fillStyle = '#aaaaaa';
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(18, 18);
      ctx.lineTo(2, 18);
      ctx.closePath();
      ctx.fill();
      ct.refresh();
    }
  }
}

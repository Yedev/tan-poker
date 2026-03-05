import Phaser from 'phaser';
import {
  CARD_WIDTH, CARD_HEIGHT, HAND_CARD_WIDTH, HAND_CARD_HEIGHT,
  SLOT_WIDTH, SLOT_HEIGHT, ENHANCE_SLOT_SIZE,
  SUITS, SUIT_SYMBOLS, SUIT_COLORS, RANK_LABELS,
  GAME_WIDTH, GAME_HEIGHT,
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
    // Draw card textures at HAND_CARD size (the largest display size) so hand
    // cards render at native resolution with no upscaling. Other contexts
    // (deck pile, board slots) scale down, which stays sharp.
    const W = HAND_CARD_WIDTH;   // 90
    const H = HAND_CARD_HEIGHT;  // 126
    // Additional 2× supersampling so even the bounce animation stays sharp.
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
        roundRect(ctx, 0, 0, W, H, 11);
        ctx.fill();
        ctx.strokeStyle = isRed ? '#aa3333' : '#333333';
        ctx.lineWidth = 1.5;
        roundRect(ctx, 1, 1, W - 2, H - 2, 10);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 21px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(RANK_LABELS[rank], 6, 4);

        ctx.font = '17px serif';
        ctx.fillText(SUIT_SYMBOLS[suit], 6, 27);

        ctx.font = '36px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SUIT_SYMBOLS[suit], W / 2, H / 2 + 6);

        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(RANK_LABELS[rank] + SUIT_SYMBOLS[suit], W - 4, H - 4);

        ct.refresh();
      }
    }

    {
      const ct = this.textures.createCanvas('card_back', W * TX, H * TX)!;
      const ctx = ct.getContext();
      ctx.scale(TX, TX);
      ctx.fillStyle = '#2a4858';
      roundRect(ctx, 0, 0, W, H, 11);
      ctx.fill();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 3;
      roundRect(ctx, 4, 4, W - 8, H - 8, 4);
      ctx.stroke();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 1;
      roundRect(ctx, 10, 10, W - 20, H - 20, 3);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 6; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillStyle = '#3a5868';
            ctx.fillRect(17 + i * 14, 17 + j * 16, 11, 13);
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

    this.makeGameBackground();
  }

  private makeGameBackground() {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const ct = this.textures.createCanvas('game_bg', W, H)!;
    const ctx = ct.getContext();

    // ── Base gradient: deep navy → dark teal ──────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, W * 0.4, H);
    grad.addColorStop(0,   '#0b1c2c');
    grad.addColorStop(0.5, '#0d2233');
    grad.addColorStop(1,   '#091a28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle felt-weave noise: tiny overlapping strokes ─────────────────
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < H; y += 3) {
      ctx.strokeStyle = (y % 6 === 0) ? '#4a8a6a' : '#2a5a4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 0; x < W; x += 3) {
      ctx.strokeStyle = (x % 6 === 0) ? '#3a7a5a' : '#1a4a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Repeating watermark suit symbols ──────────────────────────────────
    const suits = ['♠', '♥', '♦', '♣'];
    const suitsColors = ['#aaccff', '#ff8888', '#ff9966', '#88ddaa'];
    const gridX = 90;
    const gridY = 80;
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let row = 0;
    for (let y = gridY / 2; y < H + gridY; y += gridY) {
      const offsetX = (row % 2) * (gridX / 2);
      let col = 0;
      for (let x = offsetX; x < W + gridX; x += gridX) {
        const suitIdx = (row + col) % 4;
        ctx.globalAlpha = 0.055;
        ctx.fillStyle = suitsColors[suitIdx];
        ctx.fillText(suits[suitIdx], x, y);
        col++;
      }
      row++;
    }
    ctx.globalAlpha = 1;

    // ── Radial vignette: dark edges, lighter center ───────────────────────
    const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.82);
    vign.addColorStop(0, 'rgba(255,255,255,0.03)');
    vign.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);

    // ── Thin gold border frame ─────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(180,140,60,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.strokeStyle = 'rgba(180,140,60,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    ct.refresh();
  }
}

import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { createDeck } from '../logic/deck';
import { StraightFever } from '../cards/enhance/StraightFever';
import { RoyalExclusive } from '../cards/enhance/RoyalExclusive';
import { HollowBrick } from '../cards/enhance/HollowBrick';
import { CARD_WIDTH, CARD_HEIGHT, GAME_WIDTH, GAME_HEIGHT, SUITS } from '../config';

// Card strip display dimensions
const STRIP_SCALE = 1.15;
const SW = Math.round(CARD_WIDTH * STRIP_SCALE);
const SH = Math.round(CARD_HEIGHT * STRIP_SCALE);
const CARD_GAP = 10;
const SPACING = SW + CARD_GAP;
const SPEED = 0.9; // px per frame — top goes left, bottom goes right (belt loop)

export class TitleScene extends Phaser.Scene {
  private topCards: Phaser.GameObjects.Image[] = [];
  private botCards: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('TitleScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'game_bg');

    this.makeCardStrips();
    this.makeCenterContent();
    this.makeEdgeFades();
  }

  // ── Card strips ─────────────────────────────────────────────────────────

  private shuffledKeys(): string[] {
    const keys: string[] = [];
    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank++) {
        keys.push(`card_${suit}_${rank}`);
      }
    }
    return Phaser.Utils.Array.Shuffle(keys) as string[];
  }

  private makeCardStrips() {
    const keys = this.shuffledKeys();
    // One extra card on each side so there's never a gap while wrapping
    const n = Math.ceil(GAME_WIDTH / SPACING) + 4;

    const topY = SH / 2;
    const botY = GAME_HEIGHT - SH / 2;

    for (let i = 0; i < n; i++) {
      // Top strip — will scroll left
      const tk = keys[i % keys.length];
      const t = this.add.image(i * SPACING, topY, tk);
      t.setDisplaySize(SW, SH).setAlpha(0.85);
      this.topCards.push(t);

      // Bottom strip — will scroll right; offset key list for variety
      const bk = keys[(i + 13) % keys.length];
      const b = this.add.image(i * SPACING, botY, bk);
      b.setDisplaySize(SW, SH).setAlpha(0.85);
      this.botCards.push(b);
    }
  }

  // ── Center title & button ────────────────────────────────────────────────

  private makeCenterContent() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 80, '叠 牌', {
      fontSize: '72px', color: '#e8d8b8', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 8, 'Stacking Cards', {
      fontSize: '24px', color: '#8899aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 36, '卡牌构筑 · Roguelike · 物理叠塔', {
      fontSize: '16px', color: '#6a7a8a', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const btn = this.add
      .image(cx, cy + 110, 'btn_start')
      .setDisplaySize(160, 50)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setTint(0xccccff));
    btn.on('pointerout', () => btn.clearTint());
    btn.on('pointerup', () => {
      const gs = GameState.getInstance();
      gs.reset();
      gs.deck = createDeck();
      gs.enhanceSlots = [StraightFever, RoyalExclusive, HollowBrick];
      this.scene.start('BattleScene', { level: 1 });
    });
  }

  // ── Edge fade strips (left / right) ─────────────────────────────────────

  private makeEdgeFades() {
    const gfx = this.add.graphics();
    const fadeW = 72;
    const bgColor = 0x0d2233;

    // Left fade: opaque at x=0, transparent at x=fadeW
    for (let x = 0; x < fadeW; x++) {
      const a = (1 - x / fadeW) * 0.92;
      gfx.fillStyle(bgColor, a);
      gfx.fillRect(x, 0, 1, GAME_HEIGHT);
    }

    // Right fade: transparent at x=GAME_WIDTH-fadeW, opaque at x=GAME_WIDTH
    for (let x = 0; x < fadeW; x++) {
      const a = (x / fadeW) * 0.92;
      gfx.fillStyle(bgColor, a);
      gfx.fillRect(GAME_WIDTH - fadeW + x, 0, 1, GAME_HEIGHT);
    }
  }

  // ── Belt animation ───────────────────────────────────────────────────────

  update() {
    const total = this.topCards.length * SPACING;

    // Top row scrolls left — wraps at left edge
    for (const c of this.topCards) {
      c.x -= SPEED;
      if (c.x < -SW / 2) c.x += total;
    }

    // Bottom row scrolls right — wraps at right edge (belt-loop feel)
    for (const c of this.botCards) {
      c.x += SPEED;
      if (c.x > GAME_WIDTH + SW / 2) c.x -= total;
    }
  }
}

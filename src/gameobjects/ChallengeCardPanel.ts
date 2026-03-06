import Phaser from 'phaser';
import type { ChallengeCardDef } from '../types/card';
import { GAME_WIDTH } from '../config';
import { GAME_EVENTS } from '../events/GameEvents';

// ── Layout constants ──────────────────────────────────────────────────────────
const AW = 80;          // active card width
const AH = 112;         // active card height
const PW = 54;          // pending card width
const PH = 76;          // pending card height
const GAP = 10;         // gap between active card and pending stack
const MARGIN = 8;       // distance from screen edge
const TOOLTIP_W = 188;  // tooltip panel width

const TRIGGER_LABELS: Record<string, string> = {
  [GAME_EVENTS.SCORE_END]:   '触发时机：每次计分结束',
  [GAME_EVENTS.LEVEL_START]: '触发时机：关卡开始',
};

/**
 * Top-right UI panel that displays the active challenge card (large) above a
 * stacked pile of pending cards (smaller).  After each scoring round the active
 * card is destroyed and the next one becomes active.
 */
export class ChallengeCardPanel {
  private readonly scene: Phaser.Scene;
  private readonly cards: ChallengeCardDef[];
  private activeIdx: number;

  // Centre of the active card in world space
  private readonly acx: number;
  private readonly acy: number;

  // Two separate containers so hover zones are independent
  private activeC: Phaser.GameObjects.Container | null = null;
  private pendingC: Phaser.GameObjects.Container | null = null;

  // Tooltip (scene-level, always on top)
  private tooltip!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipTitle!: Phaser.GameObjects.Text;
  private tooltipTrigger!: Phaser.GameObjects.Text;
  private tooltipDesc!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, cards: ChallengeCardDef[], activeIdx: number) {
    this.scene = scene;
    this.cards = cards;
    this.activeIdx = activeIdx;

    this.acx = GAME_WIDTH - MARGIN - AW / 2;
    this.acy = MARGIN + AH / 2;

    this.buildTooltip();
    this.build();
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────

  private buildTooltip() {
    this.tooltipBg = this.scene.add.graphics();

    this.tooltipTitle = this.scene.add.text(10, 9, '', {
      fontSize: '13px', color: '#ffaaaa', fontStyle: 'bold', fontFamily: 'sans-serif',
    });
    this.tooltipTrigger = this.scene.add.text(10, 28, '', {
      fontSize: '10px', color: '#cc7777', fontFamily: 'monospace',
    });
    this.tooltipDesc = this.scene.add.text(10, 44, '', {
      fontSize: '11px', color: '#ddaaaa', fontFamily: 'sans-serif',
      wordWrap: { width: TOOLTIP_W - 20 },
    });

    this.tooltip = this.scene.add.container(0, 0, [
      this.tooltipBg, this.tooltipTitle, this.tooltipTrigger, this.tooltipDesc,
    ]);
    this.tooltip.setDepth(500);
    this.tooltip.setVisible(false);
  }

  private showTooltip(card: ChallengeCardDef, isActive: boolean) {
    this.tooltipTitle.setText(card.name);
    this.tooltipTrigger.setText(TRIGGER_LABELS[card.triggerEventName] ?? card.triggerEventName);
    this.tooltipDesc.setText(card.description);

    // Size background to fit text (approximate based on char count)
    const descLines = Math.max(1, Math.ceil(card.description.length / 20));
    const h = 50 + descLines * 14 + 10;
    const borderColor = isActive ? 0xcc4444 : 0x774444;

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x0c1c2c, 0.97);
    this.tooltipBg.fillRoundedRect(0, 0, TOOLTIP_W, h, 8);
    this.tooltipBg.lineStyle(1.5, borderColor, 1);
    this.tooltipBg.strokeRoundedRect(0, 0, TOOLTIP_W, h, 8);

    // Position: to the left of the panel, aligned to panel top
    const tx = Math.max(4, this.acx - AW / 2 - 8 - TOOLTIP_W);
    this.tooltip.setPosition(tx, MARGIN);
    this.tooltip.setVisible(true);
  }

  private hideTooltip() {
    this.tooltip.setVisible(false);
  }

  // ── Build / rebuild ────────────────────────────────────────────────────────

  private build() {
    this.activeC?.destroy();
    this.pendingC?.destroy();
    this.activeC = null;
    this.pendingC = null;

    const activeCard  = this.cards[this.activeIdx];
    const pendingCards = this.cards.slice(this.activeIdx + 1);

    // Pending stack sits below the active card
    const pendingCY = this.acy + AH / 2 + GAP + PH / 2;

    if (pendingCards.length > 0) {
      this.pendingC = this.buildPendingStack(pendingCards, this.acx, pendingCY);
    }

    // Active card drawn last so it renders above the pending stack
    if (activeCard) {
      this.activeC = this.buildActiveCard(activeCard, this.acx, this.acy);
    } else {
      // All challenge cards consumed
      const done = this.scene.add.container(this.acx, this.acy);
      done.setDepth(22);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x0a200a, 0.85);
      bg.fillRoundedRect(-AW / 2, -AH / 2, AW, AH, 10);
      bg.lineStyle(1.5, 0x336633, 0.6);
      bg.strokeRoundedRect(-AW / 2, -AH / 2, AW, AH, 10);
      done.add(bg);
      done.add(this.scene.add.text(0, 0, '✓\n挑战结束', {
        fontSize: '13px', color: '#449944', fontFamily: 'sans-serif', align: 'center',
      }).setOrigin(0.5));
      this.activeC = done;
    }
  }

  private buildActiveCard(card: ChallengeCardDef, cx: number, cy: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(cx, cy);
    c.setDepth(22);
    c.setSize(AW, AH);
    c.setInteractive({ useHandCursor: true });

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x4a1212, 0.97);
    bg.fillRoundedRect(-AW / 2, -AH / 2, AW, AH, 10);
    bg.lineStyle(2, 0xdd4444, 1);
    bg.strokeRoundedRect(-AW / 2, -AH / 2, AW, AH, 10);
    bg.lineStyle(1, 0xff7777, 0.22);
    bg.strokeRoundedRect(-AW / 2 + 4, -AH / 2 + 4, AW - 8, AH - 8, 7);
    c.add(bg);

    // Card name
    c.add(this.scene.add.text(0, -AH / 2 + 10, card.name, {
      fontSize: '12px', color: '#ffaaaa', fontStyle: 'bold',
      fontFamily: 'sans-serif', align: 'center',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: AW - 12 },
    }).setOrigin(0.5, 0));

    // Warning icon
    c.add(this.scene.add.text(0, -6, '⚠', {
      fontSize: '28px', color: '#ff5555',
    }).setOrigin(0.5));

    // Status badge with pulse
    const status = this.scene.add.text(0, AH / 2 - 13, '● 生效中', {
      fontSize: '10px', color: '#ff8888', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    c.add(status);
    this.scene.tweens.add({
      targets: status, alpha: 0.35, duration: 700,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Hover: scale up + show tooltip
    c.on('pointerover', () => {
      this.scene.tweens.killTweensOf(c);
      this.scene.tweens.add({ targets: c, scaleX: 1.07, scaleY: 1.07, duration: 120, ease: 'Quad.easeOut' });
      c.setDepth(100);
      this.showTooltip(card, true);
    });
    c.on('pointerout', () => {
      this.scene.tweens.killTweensOf(c);
      this.scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
      c.setDepth(22);
      this.hideTooltip();
    });

    return c;
  }

  private buildPendingStack(
    pendingCards: ChallengeCardDef[],
    cx: number,
    cy: number,
  ): Phaser.GameObjects.Container {
    const visN = Math.min(pendingCards.length, 3);

    const c = this.scene.add.container(cx, cy);
    c.setDepth(21);
    c.setSize(PW + (visN - 1) * 2 + 8, PH + (visN - 1) * 4 + 22);
    c.setInteractive();

    // Draw cards back→front for correct visual layering
    for (let i = visN - 1; i >= 0; i--) {
      const ox = i * 2;
      const oy = i * 4;
      const g = this.scene.add.graphics();
      g.fillStyle(0x220a0a, 0.9);
      g.fillRoundedRect(-PW / 2 + ox, -PH / 2 + oy, PW, PH, 7);
      g.lineStyle(1.5, 0x662222, 0.75);
      g.strokeRoundedRect(-PW / 2 + ox, -PH / 2 + oy, PW, PH, 7);
      g.lineStyle(0.5, 0x441111, 0.4);
      g.strokeRoundedRect(-PW / 2 + ox + 5, -PH / 2 + oy + 5, PW - 10, PH - 10, 4);
      c.add(g);
    }

    // Count + label below stack
    const stackBottom = PH / 2 + (visN - 1) * 4;
    c.add(this.scene.add.text((visN - 1) * 2 / 2, stackBottom + 4, `×${pendingCards.length} 待生效`, {
      fontSize: '10px', color: '#aa5555', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0));

    // Hover: show info of the next-in-line card
    c.on('pointerover', () => {
      c.setDepth(100);
      this.showTooltip(pendingCards[0], false);
    });
    c.on('pointerout', () => {
      c.setDepth(21);
      this.hideTooltip();
    });

    return c;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Call after each scoring to consume the active card and activate the next. */
  advance() {
    // Flash-destroy the active card then rebuild
    if (this.activeC) {
      this.scene.tweens.add({
        targets: this.activeC,
        alpha: 0,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.activeIdx++;
          this.build();
        },
      });
    } else {
      this.activeIdx++;
      this.build();
    }
  }

  destroy() {
    this.activeC?.destroy();
    this.pendingC?.destroy();
    this.tooltip?.destroy();
  }
}

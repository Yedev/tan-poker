import Phaser from 'phaser';
import type { GamePhase } from '../types/game';
import { EventBus } from '../events/EventBus';
import {
  DECK_PILE_X, DECK_PILE_Y, CARD_WIDTH, CARD_HEIGHT,
  HAND_CARD_WIDTH, HAND_CARD_HEIGHT,
  PLAY_CARDS_LIMIT,
} from '../config';

// Left sidebar width (Balatro-style info panel)
const PANEL_W = 200;
const PX = 14; // horizontal padding inside panel

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private chancesText!: Phaser.GameObjects.Text;
  private discardText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private foundationText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private scoreBtn!: Phaser.GameObjects.Image;
  private discardBtn!: Phaser.GameObjects.Image;
  private cardsText!: Phaser.GameObjects.Text;

  // Deck pile display
  private deckShadow1!: Phaser.GameObjects.Image;
  private deckShadow2!: Phaser.GameObjects.Image;
  private deckTopCard!: Phaser.GameObjects.Image;
  private deckCountText!: Phaser.GameObjects.Text;
  private deckEmptyText!: Phaser.GameObjects.Text;

  // Registry listeners
  private readonly _onScore    = (_: unknown, v: number) => this.scoreText.setText(`${Math.floor(v)}`);
  private readonly _onTarget   = (_: unknown, v: number) => this.targetText.setText(`${v}`);
  private readonly _onChances  = (_: unknown, v: number) => this.chancesText.setText(`${v}`);
  private readonly _onDiscard  = (_: unknown, v: number) => this.discardText.setText(`${v}`);
  private readonly _onFoundation = (_: unknown, v: number) =>
    this.foundationText.setText(`承重: ${v === Infinity ? '∞' : v}`);
  private readonly _onPhase    = (_: unknown, v: GamePhase) => { this.phaseText.setText(v); this.onPhaseChange(v); };
  private readonly _onDrawPile = (_: unknown, v: number) => this.onDeckCountChanged(v, true);
  private readonly _onGold     = (_: unknown, v: number) => this.goldText.setText(`◈  ${v}`);
  private readonly _onCardsPlayed = (_: unknown, v: number) => this.updateCardsText(v);
  private readonly _onLevel    = (_: unknown, v: number) => this.levelText.setText(`第 ${v} 关`);

  constructor() {
    super('UIScene');
  }

  create() {
    const mono  = { fontFamily: 'monospace' };
    const serif = { fontFamily: 'serif' };

    // ══════════════════════════════════════════════════════════════════════
    //  LEFT PANEL BACKGROUND
    // ══════════════════════════════════════════════════════════════════════
    const panelGfx = this.add.graphics();
    // Dark gradient base
    panelGfx.fillGradientStyle(0x0c1628, 0x0c1628, 0x091220, 0x091220, 1);
    panelGfx.fillRect(0, 0, PANEL_W, 720);
    // Right gold border
    panelGfx.lineStyle(2, 0x9a7d2a, 0.65);
    panelGfx.lineBetween(PANEL_W, 0, PANEL_W, 720);

    // ── Level header bar ──────────────────────────────────────────────────
    const HDR_H = 52;
    const hdrGfx = this.add.graphics();
    hdrGfx.fillGradientStyle(0xc8960a, 0xc8960a, 0x8b6510, 0x8b6510, 1);
    hdrGfx.fillRect(0, 0, PANEL_W, HDR_H);
    hdrGfx.lineStyle(1, 0xd4a830, 0.6);
    hdrGfx.lineBetween(0, HDR_H, PANEL_W, HDR_H);

    this.levelText = this.add.text(PANEL_W / 2, HDR_H / 2, '第 1 关', {
      fontSize: '21px', color: '#fff8e7', fontStyle: 'bold', ...serif,
    }).setOrigin(0.5);

    // ══════════════════════════════════════════════════════════════════════
    //  PANEL CONTENT
    // ══════════════════════════════════════════════════════════════════════
    let y = HDR_H + 10;

    // ── Target score ──────────────────────────────────────────────────────
    this.add.text(PX, y, '目标分数', { fontSize: '11px', color: '#6a7f90', ...mono });
    this.targetText = this.add.text(PANEL_W - PX, y + 1, '0', {
      fontSize: '19px', color: '#7aaabb', ...mono,
    }).setOrigin(1, 0);

    y += 28;
    this.addSep(y);

    // ── Current score ─────────────────────────────────────────────────────
    y += 7;
    this.add.text(PX, y, '当前分数', { fontSize: '11px', color: '#6a7f90', ...mono });
    this.scoreText = this.add.text(PANEL_W - PX, y + 2, '0', {
      fontSize: '36px', color: '#f5c518', fontStyle: 'bold', ...mono,
    }).setOrigin(1, 0);

    y += 48;
    this.addSep(y);

    // ── Score / discard chances ───────────────────────────────────────────
    y += 8;
    this.add.text(PX, y, '计分', { fontSize: '13px', color: '#6699bb', ...mono });
    this.chancesText = this.add.text(PANEL_W - PX, y, '3', {
      fontSize: '22px', color: '#4db8ff', fontStyle: 'bold', ...mono,
    }).setOrigin(1, 0);

    y += 30;
    this.add.text(PX, y, '弃牌', { fontSize: '13px', color: '#bb8855', ...mono });
    this.discardText = this.add.text(PANEL_W - PX, y, '1', {
      fontSize: '22px', color: '#ff9933', fontStyle: 'bold', ...mono,
    }).setOrigin(1, 0);

    y += 34;
    this.addSep(y);

    // ── Foundation / gold ─────────────────────────────────────────────────
    y += 8;
    this.foundationText = this.add.text(PX, y, '承重: ∞', {
      fontSize: '12px', color: '#557788', ...mono,
    });
    y += 20;
    this.goldText = this.add.text(PX, y, '◈  0', {
      fontSize: '15px', color: '#f5c518', ...mono,
    });

    y += 28;
    this.addSep(y);

    // ── Debug info (tiny) ─────────────────────────────────────────────────
    y += 6;
    this.phaseText = this.add.text(PX, y, '', { fontSize: '9px', color: '#2a3a4a', ...mono });
    this.fpsText   = this.add.text(PX, y + 12, 'FPS: --', { fontSize: '9px', color: '#2a3a4a', ...mono });

    // ── Cards-played indicator ────────────────────────────────────────────
    this.add.text(PANEL_W / 2, 575, '本轮出牌', {
      fontSize: '11px', color: '#6a7f90', ...mono,
    }).setOrigin(0.5);
    this.cardsText = this.add.text(PANEL_W / 2, 593, `0 / ${PLAY_CARDS_LIMIT}`, {
      fontSize: '20px', color: '#ffffff', ...mono,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // ── Score button ──────────────────────────────────────────────────────
    this.scoreBtn = this.add.image(PANEL_W / 2, 637, 'btn_score')
      .setDisplaySize(174, 52)
      .setInteractive({ useHandCursor: true })
      .on('pointerup',  () => EventBus.emit('ui:score-requested'))
      .on('pointerover', () => this.scoreBtn.setTint(0xbbffcc))
      .on('pointerout',  () => this.scoreBtn.clearTint());

    // ── Discard button ────────────────────────────────────────────────────
    this.discardBtn = this.add.image(PANEL_W / 2, 697, 'btn_discard')
      .setDisplaySize(174, 46)
      .setInteractive({ useHandCursor: true })
      .on('pointerup',  () => EventBus.emit('ui:discard-requested'))
      .on('pointerover', () => this.discardBtn.setTint(0xffbbaa))
      .on('pointerout',  () => this.discardBtn.clearTint());

    // ══════════════════════════════════════════════════════════════════════
    //  RIGHT COLUMN — DECK PILE
    // ══════════════════════════════════════════════════════════════════════
    this.add.text(DECK_PILE_X, DECK_PILE_Y - HAND_CARD_HEIGHT / 2 - 18, '牌  堆', {
      fontSize: '12px', color: '#778899', ...mono,
    }).setOrigin(0.5);

    // Stacked depth illusion (shadow cards offset behind)
    this.deckShadow1 = this.add.image(DECK_PILE_X - 5, DECK_PILE_Y - 5, 'card_back')
      .setDisplaySize(HAND_CARD_WIDTH, HAND_CARD_HEIGHT).setAlpha(0.3);
    this.deckShadow2 = this.add.image(DECK_PILE_X - 2, DECK_PILE_Y - 2, 'card_back')
      .setDisplaySize(HAND_CARD_WIDTH, HAND_CARD_HEIGHT).setAlpha(0.55);
    this.deckTopCard = this.add.image(DECK_PILE_X, DECK_PILE_Y, 'card_back')
      .setDisplaySize(HAND_CARD_WIDTH, HAND_CARD_HEIGHT);

    this.deckCountText = this.add.text(DECK_PILE_X, DECK_PILE_Y + HAND_CARD_HEIGHT / 2 + 12, '×0', {
      fontSize: '16px', color: '#cccccc', ...mono,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.deckEmptyText = this.add.text(DECK_PILE_X, DECK_PILE_Y, '空', {
      fontSize: '20px', color: '#886644', ...mono,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(1);

    // ══════════════════════════════════════════════════════════════════════
    //  REGISTRY LISTENERS
    // ══════════════════════════════════════════════════════════════════════
    this.removeRegistryListeners();

    this.registry.events.on('changedata-score',              this._onScore,       this);
    this.registry.events.on('changedata-targetScore',        this._onTarget,      this);
    this.registry.events.on('changedata-scoreChances',       this._onChances,     this);
    this.registry.events.on('changedata-discardChances',     this._onDiscard,     this);
    this.registry.events.on('changedata-foundation',         this._onFoundation,  this);
    this.registry.events.on('changedata-phase',              this._onPhase,       this);
    this.registry.events.on('changedata-drawPileCount',      this._onDrawPile,    this);
    this.registry.events.on('changedata-gold',               this._onGold,        this);
    this.registry.events.on('changedata-cardsPlayedThisRound', this._onCardsPlayed, this);
    this.registry.events.on('changedata-level',              this._onLevel,       this);

    this.events.once('shutdown', this.removeRegistryListeners, this);

    this.refreshFromRegistry();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Draw a thin separator line across the panel. */
  private addSep(y: number) {
    this.add.graphics().lineStyle(1, 0x1c2e3e, 1).lineBetween(PX, y, PANEL_W - PX, y);
  }

  private onDeckCountChanged(count: number, animate: boolean) {
    this.deckCountText.setText(`×${count}`);

    const hasCards = count > 0;
    this.deckTopCard.setAlpha(hasCards ? 1 : 0.15);
    this.deckShadow2.setAlpha(count > 1 ? 0.55 : 0);
    this.deckShadow1.setAlpha(count > 3 ? 0.3 : 0);
    this.deckEmptyText.setAlpha(hasCards ? 0 : 1);

    if (animate && hasCards) {
      this.tweens.killTweensOf(this.deckTopCard);
      this.tweens.add({
        targets: this.deckTopCard,
        scaleX: this.deckTopCard.scaleX * 0.88,
        scaleY: this.deckTopCard.scaleY * 0.88,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private refreshFromRegistry() {
    const r = this.registry;
    if (r.has('score'))         this.scoreText.setText(`${Math.floor(r.get('score'))}`);
    if (r.has('targetScore'))   this.targetText.setText(`${r.get('targetScore')}`);
    if (r.has('scoreChances'))  this.chancesText.setText(`${r.get('scoreChances')}`);
    if (r.has('discardChances')) this.discardText.setText(`${r.get('discardChances')}`);
    if (r.has('foundation')) {
      const f = r.get('foundation');
      this.foundationText.setText(`承重: ${f === Infinity ? '∞' : f}`);
    }
    if (r.has('phase')) {
      this.phaseText.setText(r.get('phase'));
      this.onPhaseChange(r.get('phase'));
    }
    if (r.has('drawPileCount'))  this.onDeckCountChanged(r.get('drawPileCount'), false);
    if (r.has('gold'))           this.goldText.setText(`◈  ${r.get('gold')}`);
    if (r.has('level'))          this.levelText.setText(`第 ${r.get('level')} 关`);
    this.updateCardsText(r.has('cardsPlayedThisRound') ? r.get('cardsPlayedThisRound') : 0);
  }

  private updateCardsText(played: number) {
    this.cardsText.setText(`${played} / ${PLAY_CARDS_LIMIT}`);
    if (played >= PLAY_CARDS_LIMIT)        this.cardsText.setColor('#ff4444');
    else if (played >= PLAY_CARDS_LIMIT - 1) this.cardsText.setColor('#ffaa33');
    else                                   this.cardsText.setColor('#ffffff');
  }

  private onPhaseChange(phase: GamePhase) {
    const isPlacing = phase === 'PLAYER_PLACING';
    this.scoreBtn.setAlpha(isPlacing ? 1 : 0.4);
    this.discardBtn.setAlpha(isPlacing ? 1 : 0.4);
    if (!isPlacing) {
      this.scoreBtn.disableInteractive();
      this.discardBtn.disableInteractive();
    } else {
      this.scoreBtn.setInteractive({ useHandCursor: true });
      this.discardBtn.setInteractive({ useHandCursor: true });
    }
  }

  update() {
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }

  private removeRegistryListeners() {
    this.registry.events.off('changedata-score',               this._onScore,       this);
    this.registry.events.off('changedata-targetScore',         this._onTarget,      this);
    this.registry.events.off('changedata-scoreChances',        this._onChances,     this);
    this.registry.events.off('changedata-discardChances',      this._onDiscard,     this);
    this.registry.events.off('changedata-foundation',          this._onFoundation,  this);
    this.registry.events.off('changedata-phase',               this._onPhase,       this);
    this.registry.events.off('changedata-drawPileCount',       this._onDrawPile,    this);
    this.registry.events.off('changedata-gold',                this._onGold,        this);
    this.registry.events.off('changedata-cardsPlayedThisRound', this._onCardsPlayed, this);
    this.registry.events.off('changedata-level',               this._onLevel,       this);
  }
}

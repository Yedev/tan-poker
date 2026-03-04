import Phaser from 'phaser';
import type { GamePhase } from '../types/game';
import { EventBus } from '../events/EventBus';
import { DECK_PILE_X, DECK_PILE_Y, CARD_WIDTH, CARD_HEIGHT, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private chancesText!: Phaser.GameObjects.Text;
  private discardText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private foundationText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private scoreBtn!: Phaser.GameObjects.Image;
  private discardBtn!: Phaser.GameObjects.Image;

  // Deck pile display
  private deckShadow1!: Phaser.GameObjects.Image;
  private deckShadow2!: Phaser.GameObjects.Image;
  private deckTopCard!: Phaser.GameObjects.Image;
  private deckCountText!: Phaser.GameObjects.Text;
  private deckEmptyText!: Phaser.GameObjects.Text;

  // Registry listener references — kept so we can remove them in shutdown()
  private readonly _onScore = (_: unknown, v: number) => this.scoreText.setText(`${Math.floor(v)}`);
  private readonly _onTarget = (_: unknown, v: number) => this.targetText.setText(`${v}`);
  private readonly _onChances = (_: unknown, v: number) => this.chancesText.setText(`计分次数: ${v}`);
  private readonly _onDiscard = (_: unknown, v: number) => this.discardText.setText(`弃牌次数: ${v}`);
  private readonly _onFoundation = (_: unknown, v: number) => this.foundationText.setText(`基层承重: ${v === Infinity ? '∞' : v}`);
  private readonly _onPhase = (_: unknown, v: GamePhase) => { this.phaseText.setText(v); this.onPhaseChange(v); };
  private readonly _onDrawPile = (_: unknown, v: number) => this.onDeckCountChanged(v, true);
  private readonly _onGold = (_: unknown, v: number) => this.goldText.setText(`金币: ${v}`);

  constructor() {
    super('UIScene');
  }

  create() {
    const ts = { fontSize: '16px', color: '#cccccc', fontFamily: 'monospace' };

    this.add.text(20, 15, '分数', { fontSize: '12px', color: '#888888', fontFamily: 'monospace' });
    this.scoreText = this.add.text(20, 32, '0', { fontSize: '28px', color: '#ffdd88', fontFamily: 'monospace' });

    this.add.text(20, 68, '目标', { fontSize: '12px', color: '#888888', fontFamily: 'monospace' });
    this.targetText = this.add.text(20, 82, '0', { ...ts, color: '#aabbcc' });

    this.chancesText = this.add.text(200, 15, '计分次数: 3', ts);
    this.discardText = this.add.text(200, 40, '弃牌次数: 2', ts);
    this.foundationText = this.add.text(200, 65, '基层承重: ∞', { ...ts, fontSize: '14px', color: '#999999' });

    this.add.text(420, 15, '金', { fontSize: '12px', color: '#888888', fontFamily: 'monospace' });
    this.goldText = this.add.text(420, 32, '金币: 0', { fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace' });

    this.phaseText = this.add.text(1260, 15, '', {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.scoreBtn = this.add.image(1180, 580, 'btn_score')
      .setDisplaySize(110, 40)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => EventBus.emit('ui:score-requested'))
      .on('pointerover', () => this.scoreBtn.setTint(0xaaffaa))
      .on('pointerout', () => this.scoreBtn.clearTint());

    this.discardBtn = this.add.image(1180, 630, 'btn_discard')
      .setDisplaySize(110, 40)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => EventBus.emit('ui:discard-requested'))
      .on('pointerover', () => this.discardBtn.setTint(0xffaaaa))
      .on('pointerout', () => this.discardBtn.clearTint());

    // ── Deck Pile Display (bottom-right) ──
    this.add.text(DECK_PILE_X, DECK_PILE_Y - 54, '牌堆', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Stacked card-back images (depth illusion)
    this.deckShadow1 = this.add.image(DECK_PILE_X - 4, DECK_PILE_Y - 4, 'card_back').setDisplaySize(CARD_WIDTH, CARD_HEIGHT).setAlpha(0.35);
    this.deckShadow2 = this.add.image(DECK_PILE_X - 2, DECK_PILE_Y - 2, 'card_back').setDisplaySize(CARD_WIDTH, CARD_HEIGHT).setAlpha(0.6);
    this.deckTopCard = this.add.image(DECK_PILE_X, DECK_PILE_Y, 'card_back').setDisplaySize(CARD_WIDTH, CARD_HEIGHT);

    // Count badge below the pile
    this.deckCountText = this.add.text(DECK_PILE_X, DECK_PILE_Y + 54, '×0', {
      fontSize: '16px', color: '#dddddd', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Empty-deck label (shown when count reaches 0)
    this.deckEmptyText = this.add.text(DECK_PILE_X, DECK_PILE_Y, '空', {
      fontSize: '18px', color: '#886644', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0).setDepth(1);

    // ── Registry Listeners ──
    // Defensively remove any stale listeners from a previous run of this scene
    // (Phaser does not auto-call an overridden shutdown() on class-based scenes,
    // so we cannot rely on the shutdown override to have cleaned these up.)
    this.removeRegistryListeners();

    this.registry.events.on('changedata-score', this._onScore, this);
    this.registry.events.on('changedata-targetScore', this._onTarget, this);
    this.registry.events.on('changedata-scoreChances', this._onChances, this);
    this.registry.events.on('changedata-discardChances', this._onDiscard, this);
    this.registry.events.on('changedata-foundation', this._onFoundation, this);
    this.registry.events.on('changedata-phase', this._onPhase, this);
    this.registry.events.on('changedata-drawPileCount', this._onDrawPile, this);
    this.registry.events.on('changedata-gold', this._onGold, this);

    // This is the correct Phaser cleanup hook — scene.events fires 'shutdown'
    // automatically when the scene is stopped, paused, or destroyed.
    this.events.once('shutdown', this.removeRegistryListeners, this);

    this.scale.on('resize', this.applyResponsiveScale, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyResponsiveScale, this));
    this.applyResponsiveScale();

    this.refreshFromRegistry();
  }

  private applyResponsiveScale() {
    if (!this.cameras?.main) return;
    const dpr = Math.round(window.devicePixelRatio || 1);
    this.cameras.main.setZoom(dpr);
    this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  private onDeckCountChanged(count: number, animate: boolean) {
    this.deckCountText.setText(`×${count}`);

    const hasCards = count > 0;
    this.deckTopCard.setAlpha(hasCards ? 1 : 0.15);
    this.deckShadow2.setAlpha(count > 1 ? 0.6 : 0);
    this.deckShadow1.setAlpha(count > 3 ? 0.35 : 0);
    this.deckEmptyText.setAlpha(hasCards ? 0 : 1);

    if (animate && hasCards) {
      // Pop animation on the top card to signal a draw happened
      const dpr = Math.round(window.devicePixelRatio || 1);
      this.tweens.killTweensOf(this.deckTopCard);
      this.tweens.add({
        targets: this.deckTopCard,
        scaleX: 0.88 / dpr,
        scaleY: 0.88 / dpr,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private refreshFromRegistry() {
    const r = this.registry;
    if (r.has('score')) this.scoreText.setText(`${Math.floor(r.get('score'))}`);
    if (r.has('targetScore')) this.targetText.setText(`${r.get('targetScore')}`);
    if (r.has('scoreChances')) this.chancesText.setText(`计分次数: ${r.get('scoreChances')}`);
    if (r.has('discardChances')) this.discardText.setText(`弃牌次数: ${r.get('discardChances')}`);
    if (r.has('foundation')) {
      const f = r.get('foundation');
      this.foundationText.setText(`基层承重: ${f === Infinity ? '∞' : f}`);
    }
    if (r.has('phase')) {
      this.phaseText.setText(r.get('phase'));
      this.onPhaseChange(r.get('phase'));
    }
    if (r.has('drawPileCount')) {
      this.onDeckCountChanged(r.get('drawPileCount'), false);
    }
    if (r.has('gold')) {
      this.goldText.setText(`金币: ${r.get('gold')}`);
    }
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

  private removeRegistryListeners() {
    this.registry.events.off('changedata-score', this._onScore, this);
    this.registry.events.off('changedata-targetScore', this._onTarget, this);
    this.registry.events.off('changedata-scoreChances', this._onChances, this);
    this.registry.events.off('changedata-discardChances', this._onDiscard, this);
    this.registry.events.off('changedata-foundation', this._onFoundation, this);
    this.registry.events.off('changedata-phase', this._onPhase, this);
    this.registry.events.off('changedata-drawPileCount', this._onDrawPile, this);
    this.registry.events.off('changedata-gold', this._onGold, this);
  }
}

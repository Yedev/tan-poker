import Phaser from 'phaser';
import type { GamePhase } from '../types/game';
import { EventBus } from '../events/EventBus';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private chancesText!: Phaser.GameObjects.Text;
  private discardText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private foundationText!: Phaser.GameObjects.Text;
  private scoreBtn!: Phaser.GameObjects.Image;
  private discardBtn!: Phaser.GameObjects.Image;

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

    this.phaseText = this.add.text(1260, 15, '', {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.scoreBtn = this.add.image(1180, 580, 'btn_score')
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => EventBus.emit('ui:score-requested'))
      .on('pointerover', () => this.scoreBtn.setTint(0xaaffaa))
      .on('pointerout', () => this.scoreBtn.clearTint());

    this.discardBtn = this.add.image(1180, 630, 'btn_discard')
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => EventBus.emit('ui:discard-requested'))
      .on('pointerover', () => this.discardBtn.setTint(0xffaaaa))
      .on('pointerout', () => this.discardBtn.clearTint());

    this.registry.events.on('changedata-score', (_: unknown, v: number) => {
      this.scoreText.setText(`${Math.floor(v)}`);
    });
    this.registry.events.on('changedata-targetScore', (_: unknown, v: number) => {
      this.targetText.setText(`${v}`);
    });
    this.registry.events.on('changedata-scoreChances', (_: unknown, v: number) => {
      this.chancesText.setText(`计分次数: ${v}`);
    });
    this.registry.events.on('changedata-discardChances', (_: unknown, v: number) => {
      this.discardText.setText(`弃牌次数: ${v}`);
    });
    this.registry.events.on('changedata-foundation', (_: unknown, v: number) => {
      this.foundationText.setText(`基层承重: ${v === Infinity ? '∞' : v}`);
    });
    this.registry.events.on('changedata-phase', (_: unknown, v: GamePhase) => {
      this.phaseText.setText(v);
      this.onPhaseChange(v);
    });
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
}

import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.image('enhance_bg', 'assets/enhance_bg.jpeg');
    this.load.image('challenge_bg', 'assets/challenge_bg.jpeg');

    // 背景音乐
    this.load.audio('battle_bgm', 'assets/balltle_bgm_01.mp3');
  }

  create() {
    this.scene.start('TitleScene');
  }
}

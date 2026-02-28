import Phaser from 'phaser';

export class SoundManager {
  private scene: Phaser.Scene;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  play(key: string) {
    if (!this.enabled) return;
    try {
      this.scene.sound.play(key);
    } catch {
      // audio not loaded yet — silent fallback
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

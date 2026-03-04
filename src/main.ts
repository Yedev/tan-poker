import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { ShopScene } from './scenes/ShopScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Scale canvas buffer to physical pixels so rendering (including fonts) is crisp on Retina/HiDPI
const dpr = Math.round(window.devicePixelRatio || 1);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH * dpr,
  height: GAME_HEIGHT * dpr,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    ShopScene,
    BattleScene,
    UIScene,
    GameOverScene,
    VictoryScene,
  ],
};

new Phaser.Game(config);

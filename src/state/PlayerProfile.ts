import type { PlayerBuild } from './PlayerBuild';
import { createDefaultPlayerBuild } from './PlayerBuild';

/** 玩家全局持久状态（跨关卡，可序列化） */
export class PlayerProfile {
  private static instance: PlayerProfile;

  currentLevel = 1;
  score = 0;
  gold = 0;
  foundation = Infinity;
  playerBuild: PlayerBuild = createDefaultPlayerBuild();
  prevLevelScore = 0;
  prevLevelTarget = 0;
  /** 由 BlackMarket 增强卡在 LEVEL_START 事件中设置，ShopScene 读取后清除 */
  blackMarketDiscount = false;

  static getInstance(): PlayerProfile {
    if (!PlayerProfile.instance) {
      PlayerProfile.instance = new PlayerProfile();
    }
    return PlayerProfile.instance;
  }

  reset(): void {
    this.currentLevel = 1;
    this.score = 0;
    this.gold = 0;
    this.foundation = Infinity;
    this.playerBuild = createDefaultPlayerBuild();
    this.prevLevelScore = 0;
    this.prevLevelTarget = 0;
    this.blackMarketDiscount = false;
  }
}

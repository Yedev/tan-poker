import type { CardData, EnhanceCardDef, ChallengeCardDef, ConsumeCardDef } from '../types/card';
import { DEFAULT_HAND_SIZE, SCORE_CHANCES_PER_LEVEL, DISCARD_CHANCES_PER_ROUND } from '../config';

export class GameState {
  private static instance: GameState;

  currentLevel = 1;
  score = 0;
  gold = 0;
  handSize = DEFAULT_HAND_SIZE;
  scoreChances = SCORE_CHANCES_PER_LEVEL;
  discardChances = DISCARD_CHANCES_PER_ROUND;
  foundation = Infinity;
  tempFoundationBonus = 0;

  deck: CardData[] = [];
  enhanceSlots: (EnhanceCardDef | null)[] = [null, null, null, null];
  enhanceInventory: EnhanceCardDef[] = [];
  challengeCards: ChallengeCardDef[] = [];
  /** @deprecated 使用 activeChallengeCards 替代，保留兼容 */
  activeChallengeIndex = 0;
  consumeCards: ConsumeCardDef[] = [];

  // ── 增强卡衰减 (熵增律) ─────────────────────────────────────────────
  /** 增强卡全局效果系数，每次计分后由EntropyLaw减少 */
  enhanceDecayMultiplier = 1.0;

  // ── 跨关卡记录 (债务催收) ───────────────────────────────────────────
  /** 上一关最终得分 */
  prevLevelScore = 0;
  /** 上一关目标分 */
  prevLevelTarget = 0;

  // ── 本关内追踪 ──────────────────────────────────────────────────────
  /** 本关总摸牌次数，用于黑洞吸积（每5张吞噬1张） */
  drawnCardCount = 0;
  /** 下次计分额外加值，坍塌掠夺触发后填充 */
  nextScoreFlatBonus = 0;
  /** 石化格子集合，格式 "li-si"，本轮不可移走 */
  petrifiedSlots: Set<string> = new Set();
  /** 本关已完成的计分轮数（用于时光晶石） */
  scoringRoundsElapsed = 0;
  /** 禁用的格子，格式 "li-si"（折叠空间/开局诅咒） */
  disabledSlots: Set<string> = new Set();
  /** 强制本关失败标志（末日时钟） */
  levelForceFailed = false;
  /** 上一层计分的花色列表（用于共鸣破坏） */
  lastScoredLayerSuits: string[] = [];

  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  reset(): void {
    this.currentLevel = 1;
    this.score = 0;
    this.gold = 0;
    this.handSize = DEFAULT_HAND_SIZE;
    this.foundation = Infinity;
    this.deck = [];
    this.enhanceSlots = [null, null, null, null];
    this.enhanceInventory = [];
    this.challengeCards = [];
    this.activeChallengeIndex = 0;
    this.consumeCards = [];
    this.enhanceDecayMultiplier = 1.0;
    this.prevLevelScore = 0;
    this.prevLevelTarget = 0;
    this.resetLevelState();
  }

  /** 每关开始时重置关内状态 */
  resetLevelState(): void {
    this.scoreChances = SCORE_CHANCES_PER_LEVEL;
    this.discardChances = DISCARD_CHANCES_PER_ROUND;
    this.tempFoundationBonus = 0;
    this.drawnCardCount = 0;
    this.nextScoreFlatBonus = 0;
    this.petrifiedSlots = new Set();
    this.scoringRoundsElapsed = 0;
    this.disabledSlots = new Set();
    this.levelForceFailed = false;
    this.lastScoredLayerSuits = [];
    this.enhanceDecayMultiplier = 1.0;
  }

  /** @deprecated 使用 resetLevelState() */
  resetRound(): void {
    this.resetLevelState();
  }

  getSnapshot() {
    return {
      level: this.currentLevel,
      score: this.score,
      gold: this.gold,
      handSize: this.handSize,
      scoreChances: this.scoreChances,
      discardChances: this.discardChances,
      foundation: this.foundation,
      enhanceDecayMultiplier: this.enhanceDecayMultiplier,
      scoringRoundsElapsed: this.scoringRoundsElapsed,
      prevLevelScore: this.prevLevelScore,
      prevLevelTarget: this.prevLevelTarget,
    };
  }
}

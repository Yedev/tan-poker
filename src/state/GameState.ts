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
  enhanceSlots: (EnhanceCardDef | null)[] = [null, null, null];
  enhanceInventory: EnhanceCardDef[] = [];
  challengeCards: ChallengeCardDef[] = [];
  consumeCards: ConsumeCardDef[] = [];

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
    this.scoreChances = SCORE_CHANCES_PER_LEVEL;
    this.discardChances = DISCARD_CHANCES_PER_ROUND;
    this.foundation = Infinity;
    this.tempFoundationBonus = 0;
    this.deck = [];
    this.enhanceSlots = [null, null, null];
    this.enhanceInventory = [];
    this.challengeCards = [];
    this.consumeCards = [];
  }

  resetRound(): void {
    this.scoreChances = SCORE_CHANCES_PER_LEVEL;
    this.discardChances = DISCARD_CHANCES_PER_ROUND;
    this.tempFoundationBonus = 0;
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
    };
  }
}

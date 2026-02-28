import { describe, it, expect, beforeEach } from 'vitest';
import type { CardData, DetectedHand } from '../types/card';
import type { ScoreLayerContext, CardDrawnContext } from '../types/events';
import { GameEventSystem } from '../events/GameEventSystem';
import { GAME_EVENTS } from '../events/GameEvents';
import { detectHandType, calculateBaseScore } from '../logic/scoring';
import { GameState } from '../state/GameState';
import { StraightFever } from '../cards/enhance/StraightFever';
import { HollowBrick } from '../cards/enhance/HollowBrick';
import { RoyalExclusive } from '../cards/enhance/RoyalExclusive';
import { LuckyDraw } from '../cards/enhance/LuckyDraw';

function card(suit: CardData['suit'], rank: CardData['rank']): CardData {
  return { id: `${suit}_${rank}`, suit, rank };
}

function makeScoreLayerCtx(layerIndex: number, cards: CardData[]): ScoreLayerContext {
  const hands = detectHandType(cards);
  const baseScore = calculateBaseScore(hands);
  return {
    phase: 'SCORING',
    level: 1,
    board: [],
    gameState: GameState.getInstance().getSnapshot(),
    layerIndex,
    cards,
    detectedHandTypes: hands,
    baseScore,
    scoreMultiplier: 1.0,
    scoreBonusFlat: 0,
    overrideLayerWeight: null,
  };
}

describe('Scoring baseline (no enhance cards)', () => {
  it('detects a straight from 3 consecutive cards', () => {
    const cards = [card('spades', 5), card('hearts', 6), card('clubs', 7)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(1);
    expect(hands[0].type).toBe('straight');
  });

  it('detects a flush from 3 same-suit cards', () => {
    const cards = [card('hearts', 2), card('hearts', 7), card('hearts', 13)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(1);
    expect(hands[0].type).toBe('flush');
  });

  it('detects a straight flush', () => {
    const cards = [card('spades', 10), card('spades', 11), card('spades', 12)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(1);
    expect(hands[0].type).toBe('straight_flush');
  });

  it('detects three of a kind', () => {
    const cards = [card('spades', 8), card('hearts', 8), card('clubs', 8)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(1);
    expect(hands[0].type).toBe('three_of_a_kind');
  });

  it('detects pair + single', () => {
    const cards = [card('spades', 2), card('hearts', 2), card('clubs', 4)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(2);
    expect(hands[0].type).toBe('pair');
    expect(hands[1].type).toBe('single');
  });

  it('calculates base score for pair + single correctly', () => {
    const cards = [card('spades', 2), card('hearts', 2), card('clubs', 4)];
    const hands = detectHandType(cards);
    const score = calculateBaseScore(hands);
    // pair: (2+2)*2.0 = 8, single: 4*1.0 = 4 => 12
    expect(score).toBe(12);
  });

  it('detects A-2-3 low straight', () => {
    const cards = [card('spades', 14), card('hearts', 2), card('clubs', 3)];
    const hands = detectHandType(cards);
    expect(hands).toHaveLength(1);
    expect(hands[0].type).toBe('straight');
  });
});

// ── StraightFever ──

describe('StraightFever (顺子狂热)', () => {
  let ges: GameEventSystem;

  beforeEach(() => {
    ges = GameEventSystem.getInstance();
    ges.unregisterAll();
  });

  it('adds +2.0 multiplier when layer has a straight', () => {
    const LAYER = 2;
    ges.registerAll(StraightFever.getHandlers(LAYER));

    const cards = [card('spades', 5), card('hearts', 6), card('clubs', 7)];
    const ctx = makeScoreLayerCtx(LAYER, cards);

    expect(ctx.detectedHandTypes[0].type).toBe('straight');
    expect(ctx.scoreMultiplier).toBe(1.0);

    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(3.0); // 1.0 + 2.0
  });

  it('adds +2.0 multiplier for straight flush too', () => {
    const LAYER = 1;
    ges.registerAll(StraightFever.getHandlers(LAYER));

    const cards = [card('hearts', 10), card('hearts', 11), card('hearts', 12)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(3.0);
  });

  it('does NOT fire for a non-straight hand on same layer', () => {
    const LAYER = 0;
    ges.registerAll(StraightFever.getHandlers(LAYER));

    const cards = [card('spades', 2), card('hearts', 2), card('clubs', 4)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(1.0); // unchanged
  });

  it('does NOT fire for a different layer', () => {
    ges.registerAll(StraightFever.getHandlers(2)); // installed on layer 2

    const cards = [card('spades', 5), card('hearts', 6), card('clubs', 7)];
    const ctx = makeScoreLayerCtx(0, cards); // scoring layer 0
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(1.0); // unchanged
  });
});

// ── HollowBrick ──

describe('HollowBrick (空心砖)', () => {
  let ges: GameEventSystem;

  beforeEach(() => {
    ges = GameEventSystem.getInstance();
    ges.unregisterAll();
  });

  it('doubles score multiplier and sets weight to 0', () => {
    const LAYER = 1;
    ges.registerAll(HollowBrick.getHandlers(LAYER));

    const cards = [card('spades', 10), card('hearts', 11)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(2.0);
    expect(ctx.overrideLayerWeight).toBe(0);
  });

  it('stacks multiplicatively with existing multiplier', () => {
    const LAYER = 0;
    ges.registerAll(HollowBrick.getHandlers(LAYER));

    const cards = [card('spades', 14)]; // single A
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ctx.scoreMultiplier = 1.5; // pretend another enhance already boosted it
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(3.0); // 1.5 * 2.0
    expect(ctx.overrideLayerWeight).toBe(0);
  });

  it('ignores other layers', () => {
    ges.registerAll(HollowBrick.getHandlers(2));

    const cards = [card('spades', 5)];
    const ctx = makeScoreLayerCtx(0, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreMultiplier).toBe(1.0);
    expect(ctx.overrideLayerWeight).toBeNull();
  });
});

// ── RoyalExclusive ──

describe('RoyalExclusive (皇室专属)', () => {
  let ges: GameEventSystem;

  beforeEach(() => {
    ges = GameEventSystem.getInstance();
    ges.unregisterAll();
  });

  it('adds +50 per J/Q/K on the layer', () => {
    const LAYER = 2;
    ges.registerAll(RoyalExclusive.getHandlers(LAYER));

    // 3 royals: J(11), Q(12), K(13)
    const cards = [card('spades', 11), card('hearts', 12), card('clubs', 13)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreBonusFlat).toBe(150); // 3 * 50
  });

  it('adds +100 for two royals mixed with a non-royal', () => {
    const LAYER = 1;
    ges.registerAll(RoyalExclusive.getHandlers(LAYER));

    const cards = [card('spades', 11), card('hearts', 5), card('clubs', 13)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreBonusFlat).toBe(100); // 2 * 50
  });

  it('adds +0 when no royals are present', () => {
    const LAYER = 0;
    ges.registerAll(RoyalExclusive.getHandlers(LAYER));

    const cards = [card('spades', 2)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreBonusFlat).toBe(0);
  });

  it('does NOT count Ace (14) as royal', () => {
    const LAYER = 2;
    ges.registerAll(RoyalExclusive.getHandlers(LAYER));

    const cards = [card('spades', 14), card('hearts', 14), card('clubs', 14)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreBonusFlat).toBe(0);
  });
});

// ── LuckyDraw ──

describe('LuckyDraw (幸运摸牌)', () => {
  let ges: GameEventSystem;
  let gs: GameState;

  beforeEach(() => {
    ges = GameEventSystem.getInstance();
    ges.unregisterAll();
    gs = GameState.getInstance();
    gs.reset();
  });

  it('increases handSize by 1 when an Ace is drawn', () => {
    ges.registerAll(LuckyDraw.getHandlers(0));

    const initial = gs.handSize;
    const ctx: CardDrawnContext = {
      phase: 'PLAYER_PLACING',
      level: 1,
      board: [],
      gameState: gs.getSnapshot(),
      card: card('spades', 14), // Ace
    };

    ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);

    expect(gs.handSize).toBe(initial + 1);
  });

  it('does NOT change handSize for non-Ace cards', () => {
    ges.registerAll(LuckyDraw.getHandlers(0));

    const initial = gs.handSize;
    const ctx: CardDrawnContext = {
      phase: 'PLAYER_PLACING',
      level: 1,
      board: [],
      gameState: gs.getSnapshot(),
      card: card('hearts', 13), // King, not Ace
    };

    ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);

    expect(gs.handSize).toBe(initial); // unchanged
  });

  it('stacks across multiple Aces drawn', () => {
    ges.registerAll(LuckyDraw.getHandlers(0));

    const initial = gs.handSize;

    for (const suit of ['spades', 'hearts', 'clubs'] as const) {
      const ctx: CardDrawnContext = {
        phase: 'PLAYER_PLACING',
        level: 1,
        board: [],
        gameState: gs.getSnapshot(),
        card: card(suit, 14),
      };
      ges.emit(GAME_EVENTS.CARD_DRAWN, ctx);
    }

    expect(gs.handSize).toBe(initial + 3);
  });
});

// ── Combined effects ──

describe('Multiple enhance cards combined', () => {
  let ges: GameEventSystem;

  beforeEach(() => {
    ges = GameEventSystem.getInstance();
    ges.unregisterAll();
  });

  it('StraightFever + HollowBrick on same layer stacks correctly', () => {
    const LAYER = 2;
    ges.registerAll(StraightFever.getHandlers(LAYER));
    ges.registerAll(HollowBrick.getHandlers(LAYER));

    const cards = [card('spades', 5), card('hearts', 6), card('clubs', 7)];
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    // StraightFever: +2.0 → multiplier = 3.0
    // HollowBrick: *2.0 → multiplier = 6.0
    expect(ctx.scoreMultiplier).toBe(6.0);
    expect(ctx.overrideLayerWeight).toBe(0);

    const finalScore = ctx.baseScore * ctx.scoreMultiplier + ctx.scoreBonusFlat;
    // baseScore = (5+6+7)*3.5 = 63
    expect(ctx.baseScore).toBe(63);
    expect(finalScore).toBe(378); // 63 * 6.0
  });

  it('RoyalExclusive + HollowBrick: bonus + doubled multiplier', () => {
    const LAYER = 1;
    ges.registerAll(RoyalExclusive.getHandlers(LAYER));
    ges.registerAll(HollowBrick.getHandlers(LAYER));

    const cards = [card('spades', 11), card('hearts', 12)]; // J + Q
    const ctx = makeScoreLayerCtx(LAYER, cards);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx);

    expect(ctx.scoreBonusFlat).toBe(100); // 2 royals * 50
    expect(ctx.scoreMultiplier).toBe(2.0); // HollowBrick
    expect(ctx.overrideLayerWeight).toBe(0);

    // baseScore: J=11, Q=12 → pair? No, different ranks → 2 singles: 11*1 + 12*1 = 23
    expect(ctx.baseScore).toBe(23);
    const finalScore = ctx.baseScore * ctx.scoreMultiplier + ctx.scoreBonusFlat;
    expect(finalScore).toBe(146); // 23 * 2.0 + 100
  });

  it('enhance cards on different layers only affect their own layer', () => {
    ges.registerAll(StraightFever.getHandlers(0));
    ges.registerAll(RoyalExclusive.getHandlers(1));
    ges.registerAll(HollowBrick.getHandlers(2));

    // Score layer 0 — StraightFever installed but no straight
    const ctx0 = makeScoreLayerCtx(0, [card('spades', 14)]);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx0);
    expect(ctx0.scoreMultiplier).toBe(1.0);
    expect(ctx0.scoreBonusFlat).toBe(0);

    // Score layer 1 — RoyalExclusive, has one K
    const ctx1 = makeScoreLayerCtx(1, [card('hearts', 13), card('clubs', 3)]);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx1);
    expect(ctx1.scoreMultiplier).toBe(1.0); // no HollowBrick here
    expect(ctx1.scoreBonusFlat).toBe(50);   // 1 royal

    // Score layer 2 — HollowBrick
    const ctx2 = makeScoreLayerCtx(2, [card('diamonds', 5), card('spades', 5), card('hearts', 5)]);
    ges.emit(GAME_EVENTS.SCORE_LAYER, ctx2);
    expect(ctx2.scoreMultiplier).toBe(2.0);
    expect(ctx2.overrideLayerWeight).toBe(0);
    expect(ctx2.scoreBonusFlat).toBe(0);
  });
});

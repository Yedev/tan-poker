import type { HandType } from './types/card';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const CARD_WIDTH = 64;
export const CARD_HEIGHT = 90;
export const SLOT_WIDTH = 72;
export const SLOT_HEIGHT = 98;
export const ENHANCE_SLOT_SIZE = 52;

export const DEFAULT_HAND_SIZE = 8;
export const SCORE_CHANCES_PER_LEVEL = 3;
export const DISCARD_CHANCES_PER_ROUND = 2;

export const HAND_TYPE_MULTIPLIERS: Record<HandType, number> = {
  single: 1.0,
  pair: 2.0,
  three_of_a_kind: 3.0,
  straight: 3.5,
  flush: 4.0,
  straight_flush: 6.0,
};

export function getTargetScore(level: number): number {
  return Math.floor(50 * Math.pow(1.6, level - 1));
}

export const LAYER_SLOT_COUNTS = [1, 2, 3, 4];

export const BOARD_LAYOUT = {
  layers: [
    {
      y: 120,
      pokerSlots: [{ x: 520 }],
      enhanceSlot: { x: 900 },
    },
    {
      y: 230,
      pokerSlots: [{ x: 480 }, { x: 560 }],
      enhanceSlot: { x: 900 },
    },
    {
      y: 340,
      pokerSlots: [{ x: 440 }, { x: 520 }, { x: 600 }],
      enhanceSlot: { x: 900 },
    },
    {
      y: 450,
      pokerSlots: [{ x: 400 }, { x: 480 }, { x: 560 }, { x: 640 }],
      enhanceSlot: { x: 900 },
    },
  ],
};

export const HAND_Y = 600;
export const HAND_SPACING = 68;
export const HAND_CARD_SCALE = 1.4;

// Deck pile display position (right column)
export const DECK_PILE_X = 1190;
export const DECK_PILE_Y = 300;

export const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'] as const;
export const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦',
};
export const SUIT_COLORS: Record<string, string> = {
  spades: '#1a1a1a', hearts: '#cc0000', clubs: '#1a1a1a', diamonds: '#cc0000',
};
export const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

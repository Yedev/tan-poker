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
export const DISCARD_CHANCES_PER_ROUND = 1;
export const PLAY_CARDS_LIMIT = 5;
export const DISCARD_CARDS_LIMIT = 5;

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

export const BOARD_TOP_Y = 120;
export const LAYER_SPACING = 110;
// Center-to-center distance between adjacent poker slots in a row
export const SLOT_SPACING = 80;

function buildBoardLayout() {
  const cx = GAME_WIDTH / 2;
  // Gap from rightmost poker-slot centre to enhance-slot centre:
  // half poker slot + half enhance slot + 8 px breathing room
  const enhGap = Math.round(SLOT_SPACING / 2 + ENHANCE_SLOT_SIZE / 2) + 24;

  const layers = LAYER_SLOT_COUNTS.map((count, li) => {
    const y = BOARD_TOP_Y + li * LAYER_SPACING;
    const pokerSlots = Array.from({ length: count }, (_, j) => ({
      x: Math.round(cx - ((count - 1) / 2) * SLOT_SPACING + j * SLOT_SPACING),
    }));
    const rightmostX = pokerSlots[pokerSlots.length - 1].x;
    return { y, pokerSlots, enhanceSlot: { x: rightmostX + enhGap } };
  });
  return { layers };
}

export const BOARD_LAYOUT = buildBoardLayout();

export const HAND_Y = 600;
export const HAND_SPACING = 68;
export const HAND_CARD_SCALE = 1.4;
export const HAND_CARD_WIDTH = Math.round(CARD_WIDTH * HAND_CARD_SCALE);   // 90
export const HAND_CARD_HEIGHT = Math.round(CARD_HEIGHT * HAND_CARD_SCALE); // 126

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

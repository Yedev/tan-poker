import type { CardData, DetectedHand, HandType } from '../types/card';
import { HAND_TYPE_MULTIPLIERS } from '../config';

export const HAND_TYPE_LABELS: Record<string, string> = {
  single: '单张',
  pair: '对子',
  three_of_a_kind: '三条',
  straight: '顺子',
  flush: '同花',
  straight_flush: '同花顺',
};

function isSameRank(cards: CardData[]): boolean {
  return cards.every(c => c.rank === cards[0].rank);
}

function isSameSuit(cards: CardData[]): boolean {
  return cards.every(c => c.suit === cards[0].suit);
}

function isConsecutive(cards: CardData[]): boolean {
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function isLowStraight(cards: CardData[]): boolean {
  if (cards.length < 3) return false;
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
  const lowRanks = ranks.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
  for (let i = 1; i < lowRanks.length; i++) {
    if (lowRanks[i] !== lowRanks[i - 1] + 1) return false;
  }
  return ranks.includes(14);
}

export function detectHandType(cards: CardData[]): DetectedHand[] {
  const validCards = cards.filter(Boolean);
  if (validCards.length === 0) return [];
  if (validCards.length === 1) return [{ type: 'single', cards: validCards }];

  if (validCards.length === 3) {
    if (isSameSuit(validCards) && (isConsecutive(validCards) || isLowStraight(validCards))) {
      return [{ type: 'straight_flush', cards: validCards }];
    }
    if (isSameSuit(validCards)) {
      return [{ type: 'flush', cards: validCards }];
    }
    if (isConsecutive(validCards) || isLowStraight(validCards)) {
      return [{ type: 'straight', cards: validCards }];
    }
    if (isSameRank(validCards)) {
      return [{ type: 'three_of_a_kind', cards: validCards }];
    }

    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (validCards[i].rank === validCards[j].rank) {
          const pair = [validCards[i], validCards[j]];
          const single = validCards.filter((_, idx) => idx !== i && idx !== j);
          return [
            { type: 'pair', cards: pair },
            { type: 'single', cards: single },
          ];
        }
      }
    }

    return validCards.map(c => ({ type: 'single' as HandType, cards: [c] }));
  }

  if (validCards.length === 2) {
    if (validCards[0].rank === validCards[1].rank) {
      return [{ type: 'pair', cards: validCards }];
    }
    return validCards.map(c => ({ type: 'single' as HandType, cards: [c] }));
  }

  return validCards.map(c => ({ type: 'single' as HandType, cards: [c] }));
}

export function calculateBaseScore(hands: DetectedHand[]): number {
  let total = 0;
  for (const hand of hands) {
    const faceSum = hand.cards.reduce((sum, c) => sum + c.rank, 0);
    total += faceSum * HAND_TYPE_MULTIPLIERS[hand.type];
  }
  return total;
}

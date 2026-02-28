import type { CardData, Suit, Rank } from '../types/card';
import { SUITS } from '../config';

let cardIdCounter = 0;

export function createDeck(): CardData[] {
  const deck: CardData[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({
        id: `card_${cardIdCounter++}`,
        suit: suit as Suit,
        rank: rank as Rank,
      });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function draw(pile: CardData[], count: number): CardData[] {
  return pile.splice(0, Math.min(count, pile.length));
}

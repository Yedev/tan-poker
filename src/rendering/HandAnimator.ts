import Phaser from 'phaser';
import type { CardData } from '../types/card';
import { Card } from '../gameobjects/Card';
import { HAND_Y, HAND_SPACING, HAND_CARD_SCALE, GAME_WIDTH } from '../config';

export class HandAnimator {
  handCards: Card[] = [];

  constructor(
    private scene: Phaser.Scene,
    private deckPileX: number,
    private deckPileY: number,
  ) {}

  animateDraw(newCards: CardData[], prevCount: number): void {
    const totalCount = prevCount + newCards.length;

    // Snap existing hand cards to their updated positions
    for (let i = 0; i < prevCount; i++) {
      const card = this.handCards[i];
      const { x, y, angle } = this.handCardTransform(i, totalCount);
      card.stopFloat();
      card.setHome(x, y, angle);
      card.setPosition(x, y);
      card.setAngle(angle);
      card.homeDepth = 10 + i;
      card.setDepth(10 + i);
      if (!card.isSelected) card.startFloat(i * 150);
    }

    // Animate each new card flying from the deck pile to its hand position
    for (let i = 0; i < newCards.length; i++) {
      const cardData = newCards[i];
      const { x: finalX, y: finalY, angle: finalAngle } = this.handCardTransform(prevCount + i, totalCount);
      const finalDepth = 10 + prevCount + i;

      const card = new Card(this.scene, this.deckPileX, this.deckPileY, cardData);
      card.setTexture('card_back');
      card.location = 'hand';
      card.setDepth(finalDepth);
      this.handCards.push(card);

      this.scene.tweens.add({
        targets: card,
        x: finalX,
        y: finalY,
        angle: finalAngle,
        scaleX: HAND_CARD_SCALE,
        scaleY: HAND_CARD_SCALE,
        duration: 260,
        delay: i * 75,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          card.setTexture(`card_${cardData.suit}_${cardData.rank}`);
          card.setHome(finalX, finalY, finalAngle);
          card.homeDepth = finalDepth;
          card.setDepth(finalDepth);
          this.scene.tweens.add({
            targets: card,
            scaleX: HAND_CARD_SCALE * 1.08,
            scaleY: HAND_CARD_SCALE * 1.08,
            duration: 60,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => card.startFloat((prevCount + i) * 150),
          });
        },
      });
    }
  }

  layout(): void {
    const count = this.handCards.length;
    if (count === 0) return;
    for (let i = 0; i < count; i++) {
      const card = this.handCards[i];
      const { x, y, angle } = this.handCardTransform(i, count);
      card.stopFloat();
      card.setHome(x, y, angle);
      card.setPosition(x, y);
      card.setAngle(angle);
      card.homeDepth = 10 + i;
      card.setDepth(10 + i);
      if (!card.isSelected) card.startFloat(i * 150);
    }
  }

  removeCard(card: Card): void {
    const idx = this.handCards.indexOf(card);
    if (idx >= 0) this.handCards.splice(idx, 1);
  }

  /**
   * Uniform fan arc, Balatro-style:
   *   t ∈ [-1, +1]  (left → right)
   *   angle = t × 7°           — symmetric fan rotation (reduced arc)
   *   y     = HAND_Y + t² × 14 — parabolic arc, centre highest (reduced arc)
   */
  handCardTransform(index: number, total: number): { x: number; y: number; angle: number } {
    const totalWidth = (total - 1) * HAND_SPACING;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;
    const x = startX + index * HAND_SPACING;
    const t = total > 1 ? (index / (total - 1)) * 2 - 1 : 0;
    const angle = t * 7;
    const y = HAND_Y + t * t * 14;
    return { x, y, angle };
  }
}

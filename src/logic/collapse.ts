import type { Layer, CardData, CollapseResult } from '../types/card';

export function getLayerWeight(layer: Layer): number {
  if (layer.overrideWeight !== undefined && layer.overrideWeight !== null) {
    return layer.overrideWeight;
  }
  return layer.pokerSlots.reduce((sum, card) => sum + (card ? card.rank : 0), 0);
}

export function getWeightAbove(layers: Layer[], targetIndex: number): number {
  let weight = 0;
  for (let i = 0; i < targetIndex; i++) {
    weight += getLayerWeight(layers[i]);
  }
  return weight;
}

export function checkCollapse(layers: Layer[], foundation: number): CollapseResult {
  const noCollapse: CollapseResult = {
    collapsed: false,
    triggerLayerIndex: -1,
    destroyedLayerIndices: [],
    destroyedCards: [],
  };

  if (foundation !== Infinity) {
    const totalWeight = layers.reduce((sum, l) => sum + getLayerWeight(l), 0);
    if (totalWeight > foundation) {
      return {
        collapsed: true,
        triggerLayerIndex: -1,
        destroyedLayerIndices: layers.map((_, i) => i),
        destroyedCards: layers.flatMap(l => l.pokerSlots.filter(Boolean) as CardData[]),
      };
    }
  }

  for (let i = layers.length - 1; i >= 1; i--) {
    const layerWeight = getLayerWeight(layers[i]);
    const above = getWeightAbove(layers, i);
    if (above > 0 && layerWeight < above) {
      const destroyedIndices: number[] = [];
      const destroyedCards: CardData[] = [];
      for (let j = 0; j < i; j++) {
        destroyedIndices.push(j);
        destroyedCards.push(...(layers[j].pokerSlots.filter(Boolean) as CardData[]));
      }
      return {
        collapsed: true,
        triggerLayerIndex: i,
        destroyedLayerIndices: destroyedIndices,
        destroyedCards,
      };
    }
  }

  return noCollapse;
}

export function wouldCollapse(layers: Layer[], foundation: number, layerIndex: number, slotIndex: number, card: CardData): CollapseResult {
  const simLayers: Layer[] = layers.map((l, i) => ({
    pokerSlots: l.pokerSlots.map((s, j) => {
      if (i === layerIndex && j === slotIndex) return card;
      return s;
    }),
    overrideWeight: l.overrideWeight,
  }));
  return checkCollapse(simLayers, foundation);
}

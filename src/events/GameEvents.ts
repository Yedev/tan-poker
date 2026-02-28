export const GAME_EVENTS = {
  LEVEL_START:        'level:start',
  LEVEL_END:          'level:end',

  CARD_PLACED:        'card:placed',
  CARD_DISCARDED:     'card:discarded',
  CARD_DRAWN:         'card:drawn',
  CONSUME_CARD_USED:  'consume:used',
  ENHANCE_CARD_MOVED: 'enhance:moved',

  SCORE_START:        'score:start',
  SCORE_LAYER:        'score:layer',
  SCORE_END:          'score:end',

  COLLAPSE_TRIGGERED: 'collapse:triggered',
} as const;

export type GameEventName = typeof GAME_EVENTS[keyof typeof GAME_EVENTS];

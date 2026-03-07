import type { GamePhase } from '../types/game';
import { Logger } from '../utils/Logger';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  LEVEL_START:    ['PLAYER_PLACING'],
  PLAYER_PLACING: ['SCORING'],
  SCORING:        ['PLAYER_PLACING', 'LEVEL_END'],
  LEVEL_END:      [],
};

export class PhaseManager {
  private phase: GamePhase = 'LEVEL_START';
  private onPhaseChange?: (phase: GamePhase) => void;

  constructor(onPhaseChange?: (phase: GamePhase) => void) {
    this.onPhaseChange = onPhaseChange;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  transitionTo(next: GamePhase): void {
    const prev = this.phase;
    if (!VALID_TRANSITIONS[prev].includes(next)) {
      Logger.warn(`非法相位转换: ${prev} → ${next}`);
      return;
    }
    Logger.phase(`${prev} → ${next}`);
    this.phase = next;
    this.onPhaseChange?.(next);
  }
}

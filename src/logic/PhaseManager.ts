import type { GamePhase } from '../types/game';
import { Logger } from '../utils/Logger';

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
    Logger.phase(`${prev} → ${next}`);
    this.phase = next;
    this.onPhaseChange?.(next);
  }
}

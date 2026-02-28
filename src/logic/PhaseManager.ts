import type { GamePhase } from '../types/game';

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
    this.phase = next;
    this.onPhaseChange?.(next);
  }
}

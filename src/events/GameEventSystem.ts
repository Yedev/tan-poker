import type { GameEventName } from './GameEvents';
import type { RegisteredHandler, BaseEventContext } from '../types/events';

export class GameEventSystem {
  private static instance: GameEventSystem;
  private handlers: RegisteredHandler[] = [];

  static getInstance(): GameEventSystem {
    if (!GameEventSystem.instance) {
      GameEventSystem.instance = new GameEventSystem();
    }
    return GameEventSystem.instance;
  }

  register(handler: RegisteredHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  registerAll(handlers: RegisteredHandler[]): void {
    for (const h of handlers) {
      this.handlers.push(h);
    }
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  unregister(sourceId: string): void {
    this.handlers = this.handlers.filter(h => h.sourceId !== sourceId);
  }

  unregisterAll(): void {
    this.handlers = [];
  }

  emit<T extends BaseEventContext>(eventName: GameEventName, context: T): T {
    const matching = this.handlers.filter(h => h.eventName === eventName);
    for (const h of matching) {
      h.handler(context);
    }
    return context;
  }
}

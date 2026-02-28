import type { GameEventName } from './GameEvents';
import type { RegisteredHandler, BaseEventContext } from '../types/events';
import { Logger } from '../utils/Logger';

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
    Logger.info(`注册 handler: [${handler.sourceType}] ${handler.sourceId}  事件=${handler.eventName}  priority=${handler.priority}`);
  }

  registerAll(handlers: RegisteredHandler[]): void {
    for (const h of handlers) {
      this.handlers.push(h);
      Logger.info(`注册 handler: [${h.sourceType}] ${h.sourceId}  事件=${h.eventName}  priority=${h.priority}`);
    }
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  unregister(sourceId: string): void {
    const before = this.handlers.length;
    this.handlers = this.handlers.filter(h => h.sourceId !== sourceId);
    Logger.info(`注销 handler: ${sourceId}  (移除 ${before - this.handlers.length} 个)`);
  }

  unregisterAll(): void {
    Logger.info(`注销所有 handlers (共 ${this.handlers.length} 个)`);
    this.handlers = [];
  }

  emit<T extends BaseEventContext>(eventName: GameEventName, context: T): T {
    const matching = this.handlers.filter(h => h.eventName === eventName);
    Logger.event(eventName, matching.length);

    for (const h of matching) {
      const sideEffectsBefore = context.sideEffects ? [...context.sideEffects] : [];
      h.handler(context);
      // 检测 handler 是否添加了新的 sideEffects
      const newEffects = context.sideEffects
        ? context.sideEffects.slice(sideEffectsBefore.length)
        : [];
      Logger.handler(h.sourceId, h.sourceType, h.priority, true, newEffects.length ? newEffects : undefined);
    }

    return context;
  }
}

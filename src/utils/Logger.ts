/**
 * Logger — 统一的彩色控制台日志系统
 *
 * 使用示例：
 *   Logger.phase('LEVEL_START → PLAYER_PLACING');
 *   Logger.event('score:layer', { layerIndex: 0 });
 *   Logger.card('place', '♠A → Layer0 Slot2');
 *   Logger.score('Layer0: 对子 base=20 ×2.0 +0 → 40');
 *   Logger.collapse('触发: Layer2 → 销毁 [0,1]');
 *   Logger.deck('摸牌: 5张 (剩余: 23)');
 */

type LogCategory = 'phase' | 'event' | 'handler' | 'card' | 'score' | 'collapse' | 'deck' | 'shop' | 'effect' | 'info' | 'warn';

interface LogStyle {
  badge: string;
  badgeStyle: string;
  msgStyle: string;
}

const STYLES: Record<LogCategory, LogStyle> = {
  phase:    { badge: ' PHASE ',    badgeStyle: 'background:#3d5a80;color:#e0fbfc;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#7ec8e3;font-weight:bold' },
  event:    { badge: ' EVENT ',    badgeStyle: 'background:#293241;color:#b5e853;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#b5e853' },
  handler:  { badge: ' HANDLER ',  badgeStyle: 'background:#1b1b2f;color:#a29bfe;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#a29bfe' },
  card:     { badge: ' CARD ',     badgeStyle: 'background:#2d3436;color:#ffd700;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#ffd700' },
  score:    { badge: ' SCORE ',    badgeStyle: 'background:#1e3a2f;color:#00b894;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#55efc4' },
  collapse: { badge: ' COLLAPSE ', badgeStyle: 'background:#4a0000;color:#ff7675;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#ff6b6b;font-weight:bold' },
  deck:     { badge: ' DECK ',     badgeStyle: 'background:#2d3436;color:#74b9ff;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#74b9ff' },
  shop:     { badge: ' SHOP ',     badgeStyle: 'background:#6c2b80;color:#fd79a8;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#fd79a8' },
  effect:   { badge: ' EFFECT ',   badgeStyle: 'background:#614700;color:#fdcb6e;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#fdcb6e' },
  info:     { badge: ' INFO ',     badgeStyle: 'background:#2d3436;color:#dfe6e9;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#dfe6e9' },
  warn:     { badge: ' WARN ',     badgeStyle: 'background:#7d5a00;color:#ffeaa7;font-weight:bold;border-radius:3px;padding:1px 4px', msgStyle: 'color:#ffeaa7' },
};

export class Logger {
  /** 全局开关：false 时所有日志静音 */
  static enabled = true;

  /** 详细模式：true 时打印 handler 细节和 ctx 数据快照 */
  static verbose = false;

  // ── 快捷方法 ──────────────────────────────────────────────

  static phase(msg: string, extra?: unknown): void {
    Logger._log('phase', msg, extra);
  }

  static event(name: string, matchedHandlers: number, extra?: unknown): void {
    Logger._log('event', `${name}  (handlers: ${matchedHandlers})`, extra);
  }

  static handler(sourceId: string, sourceType: string, priority: number, applied: boolean, sideEffects?: unknown): void {
    if (!Logger.verbose) return;
    const mark = applied ? '✓' : '—';
    const msg = `${mark} [${sourceType}] ${sourceId}  priority=${priority}` +
      (sideEffects ? `  sideEffects=${JSON.stringify(sideEffects)}` : '');
    Logger._log('handler', msg);
  }

  static card(action: string, detail: string, extra?: unknown): void {
    Logger._log('card', `${action}: ${detail}`, extra);
  }

  static score(msg: string, extra?: unknown): void {
    Logger._log('score', msg, extra);
  }

  static collapse(msg: string, extra?: unknown): void {
    Logger._log('collapse', msg, extra);
  }

  static deck(msg: string, extra?: unknown): void {
    Logger._log('deck', msg, extra);
  }

  static shop(msg: string, extra?: unknown): void {
    Logger._log('shop', msg, extra);
  }

  static effect(msg: string, extra?: unknown): void {
    Logger._log('effect', msg, extra);
  }

  static info(msg: string, extra?: unknown): void {
    Logger._log('info', msg, extra);
  }

  static warn(msg: string, extra?: unknown): void {
    Logger._log('warn', msg, extra);
  }

  // ── 格式化辅助 ────────────────────────────────────────────

  /** 将 CardData 格式化为可读字符串，如 "♠A(14)" */
  static fmtCard(card: { suit: string; rank: number }): string {
    const SUIT_ICONS: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
    const RANK_NAMES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const icon = SUIT_ICONS[card.suit] ?? card.suit;
    const rankStr = RANK_NAMES[card.rank] ?? String(card.rank);
    return `${icon}${rankStr}`;
  }

  /** 将多张牌格式化为列表 */
  static fmtCards(cards: Array<{ suit: string; rank: number }>): string {
    return cards.map(Logger.fmtCard).join(' ');
  }

  // ── 内部实现 ──────────────────────────────────────────────

  private static _log(category: LogCategory, msg: string, extra?: unknown): void {
    if (!Logger.enabled) return;
    const s = STYLES[category];
    if (extra !== undefined) {
      console.log(`%c${s.badge}%c ${msg}`, s.badgeStyle, s.msgStyle, extra);
    } else {
      console.log(`%c${s.badge}%c ${msg}`, s.badgeStyle, s.msgStyle);
    }
  }
}

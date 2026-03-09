/**
 * 关卡数值配置 · 全20关
 * 所有数值可在此文件统一调整
 */

export type ChallengeTier = 1 | 2 | 3 | 4;

export interface LevelConfig {
  /** 关卡编号 (1-20) */
  level: number;
  /** 关卡名称 */
  name: string;
  /** 目标分数 */
  targetScore: number;
  /** 计分机会次数 */
  scoreChances: number;
  /** 同时激活的挑战卡槽数量 (0=无挑战) */
  challengeSlotCount: number;
  /** 最低可行分 (设计参考) */
  minViableScore: number;
  /** 本关挑战卡层级池 — 随机从各层各取N张 */
  challengePools: { tier: ChallengeTier; count: number }[];
  /** 是否强制激活末日时钟 (关20) */
  forceDoomsday?: boolean;
}

/**
 * 全20关卡配置
 * 分四个色阶：
 *   绿=入门区(1~5)  蓝=发展区(6~10)  金=高压区(11~15)  红=极限区(16~20)
 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  // ── 绿色区 · 入门区 (1~5) ─────────────────────────────────────────────
  {
    level: 1,
    name: '入门',
    targetScore: 50,
    scoreChances: 3,
    challengeSlotCount: 0,
    minViableScore: 20,
    challengePools: [],
  },
  {
    level: 2,
    name: '初窥',
    targetScore: 100,
    scoreChances: 3,
    challengeSlotCount: 1,
    minViableScore: 40,
    challengePools: [{ tier: 1, count: 1 }],
  },
  {
    level: 3,
    name: '磨合',
    targetScore: 180,
    scoreChances: 3,
    challengeSlotCount: 1,
    minViableScore: 70,
    challengePools: [{ tier: 1, count: 1 }],
  },
  {
    level: 4,
    name: '博弈',
    targetScore: 300,
    scoreChances: 3,
    challengeSlotCount: 2,
    minViableScore: 120,
    challengePools: [{ tier: 1, count: 1 }, { tier: 2, count: 1 }],
  },
  {
    level: 5,
    name: '突破',
    targetScore: 480,
    scoreChances: 3,
    challengeSlotCount: 2,
    minViableScore: 180,
    challengePools: [{ tier: 1, count: 1 }, { tier: 2, count: 1 }],
  },
  // ── 蓝色区 · 发展区 (6~10) ───────────────────────────────────────────
  {
    level: 6,
    name: '精算',
    targetScore: 750,
    scoreChances: 3,
    challengeSlotCount: 2,
    minViableScore: 280,
    challengePools: [{ tier: 2, count: 2 }],
  },
  {
    level: 7,
    name: '高压',
    targetScore: 1150,
    scoreChances: 3,
    challengeSlotCount: 3,
    minViableScore: 420,
    challengePools: [{ tier: 2, count: 3 }],
  },
  {
    level: 8,
    name: '均衡',
    targetScore: 1700,
    scoreChances: 3,
    challengeSlotCount: 3,
    minViableScore: 620,
    challengePools: [{ tier: 2, count: 3 }],
  },
  {
    level: 9,
    name: '扩张',
    targetScore: 2400,
    scoreChances: 4,
    challengeSlotCount: 3,
    minViableScore: 900,
    challengePools: [{ tier: 2, count: 1 }, { tier: 3, count: 2 }],
  },
  {
    level: 10,
    name: '转折',
    targetScore: 3200,
    scoreChances: 4,
    challengeSlotCount: 3,
    minViableScore: 1200,
    challengePools: [{ tier: 2, count: 1 }, { tier: 3, count: 2 }],
  },
  // ── 金色区 · 高压区 (11~15) ──────────────────────────────────────────
  {
    level: 11,
    name: '角力',
    targetScore: 4200,
    scoreChances: 4,
    challengeSlotCount: 4,
    minViableScore: 1600,
    challengePools: [{ tier: 3, count: 4 }],
  },
  {
    level: 12,
    name: '磨砺',
    targetScore: 5500,
    scoreChances: 4,
    challengeSlotCount: 4,
    minViableScore: 2000,
    challengePools: [{ tier: 3, count: 4 }],
  },
  {
    level: 13,
    name: '深渊',
    targetScore: 7000,
    scoreChances: 4,
    challengeSlotCount: 4,
    minViableScore: 2600,
    challengePools: [{ tier: 3, count: 4 }],
  },
  {
    level: 14,
    name: '极限',
    targetScore: 8800,
    scoreChances: 4,
    challengeSlotCount: 4,
    minViableScore: 3200,
    challengePools: [{ tier: 3, count: 1 }, { tier: 4, count: 3 }],
  },
  {
    level: 15,
    name: '临界',
    targetScore: 11000,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 4000,
    challengePools: [{ tier: 3, count: 1 }, { tier: 4, count: 3 }],
  },
  // ── 红色区 · 极限区 (16~20) ──────────────────────────────────────────
  {
    level: 16,
    name: '虚空',
    targetScore: 14000,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 5000,
    challengePools: [{ tier: 4, count: 4 }],
  },
  {
    level: 17,
    name: '裂变',
    targetScore: 17500,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 6500,
    challengePools: [{ tier: 4, count: 4 }],
  },
  {
    level: 18,
    name: '歧途',
    targetScore: 22000,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 8000,
    challengePools: [{ tier: 4, count: 4 }],
  },
  {
    level: 19,
    name: '终章',
    targetScore: 28000,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 10000,
    challengePools: [{ tier: 4, count: 4 }],
  },
  {
    level: 20,
    name: '封神',
    targetScore: 36000,
    scoreChances: 5,
    challengeSlotCount: 4,
    minViableScore: 13000,
    challengePools: [{ tier: 4, count: 3 }],
    forceDoomsday: true,
  },
];

/** 根据关卡号获取配置，超出范围返回最后一关配置 */
export function getLevelConfig(level: number): LevelConfig {
  const idx = Math.min(level - 1, LEVEL_CONFIGS.length - 1);
  return LEVEL_CONFIGS[Math.max(0, idx)];
}

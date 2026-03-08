import Phaser from 'phaser';

export { AcidRain } from './AcidRain';
export { Earthquake } from './Earthquake';
export { Detention } from './Detention';
export { OpeningCurse } from './OpeningCurse';
export { HourglassTax } from './HourglassTax';
export { ThinIce } from './ThinIce';
export { MirrorEcho } from './MirrorEcho';
export { GreedCurse } from './GreedCurse';
export { TimePressure } from './TimePressure';
export { FoldSpace } from './FoldSpace';
export { Petrify } from './Petrify';
export { GravityAccel } from './GravityAccel';
export { ChainReaction } from './ChainReaction';
export { Headwind } from './Headwind';
export { BlackHole } from './BlackHole';
export { Resonance } from './Resonance';
export { EntropyLaw } from './EntropyLaw';
export { MirrorWorld } from './MirrorWorld';
export { DebtCollect } from './DebtCollect';
export { Doomsday } from './Doomsday';

import { AcidRain } from './AcidRain';
import { Earthquake } from './Earthquake';
import { Detention } from './Detention';
import { OpeningCurse } from './OpeningCurse';
import { HourglassTax } from './HourglassTax';
import { ThinIce } from './ThinIce';
import { MirrorEcho } from './MirrorEcho';
import { GreedCurse } from './GreedCurse';
import { TimePressure } from './TimePressure';
import { FoldSpace } from './FoldSpace';
import { Petrify } from './Petrify';
import { GravityAccel } from './GravityAccel';
import { ChainReaction } from './ChainReaction';
import { Headwind } from './Headwind';
import { BlackHole } from './BlackHole';
import { Resonance } from './Resonance';
import { EntropyLaw } from './EntropyLaw';
import { MirrorWorld } from './MirrorWorld';
import { DebtCollect } from './DebtCollect';
import { Doomsday } from './Doomsday';
import type { ChallengeCardDef } from '../../types/card';
import type { LevelConfig } from '../../config/levels';

/** Tier1 ★★☆☆ — 关2~5 */
export const Tier1ChallengeCards: ChallengeCardDef[] = [
  AcidRain,
  HourglassTax,
  ThinIce,
];

/** Tier2 ★★★☆ — 关4~12 */
export const Tier2ChallengeCards: ChallengeCardDef[] = [
  Earthquake,
  Detention,
  MirrorEcho,
  GreedCurse,
  TimePressure,
  FoldSpace,
  Petrify,
];

/** Tier3 ★★★★ — 关9~17 */
export const Tier3ChallengeCards: ChallengeCardDef[] = [
  OpeningCurse,
  GravityAccel,
  ChainReaction,
  Headwind,
  BlackHole,
  Resonance,
];

/** Tier4 ★★★★★ — 关14+ */
export const Tier4ChallengeCards: ChallengeCardDef[] = [
  EntropyLaw,
  MirrorWorld,
  DebtCollect,
  Doomsday,
];

export const AllChallengeCards: ChallengeCardDef[] = [
  ...Tier1ChallengeCards,
  ...Tier2ChallengeCards,
  ...Tier3ChallengeCards,
  ...Tier4ChallengeCards,
];

/** 根据层级获取对应的挑战卡池 */
export function getChallengeCardsByTier(tier: 1 | 2 | 3 | 4): ChallengeCardDef[] {
  switch (tier) {
    case 1: return Tier1ChallengeCards;
    case 2: return Tier2ChallengeCards;
    case 3: return Tier3ChallengeCards;
    case 4: return Tier4ChallengeCards;
  }
}

/**
 * 根据关卡配置的 challengePools 随机生成挑战卡数组
 */
export function generateChallengeCards(levelConfig: LevelConfig): ChallengeCardDef[] {
  const result: ChallengeCardDef[] = [];
  const rng = Phaser.Math.RND;

  for (const pool of levelConfig.challengePools) {
    const tierCards = getChallengeCardsByTier(pool.tier);
    const shuffled = rng.shuffle(tierCards);
    const selected = shuffled.slice(0, pool.count);
    result.push(...selected);
  }

  return result;
}

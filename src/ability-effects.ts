import type { Run } from './core.ts';

export const LOW_HEALTH_PERCENT = 35;
export const CULL_DAMAGE_PERCENT = 15;
export const RESOLVE_REDUCTION_PERCENT = 10;

export interface MeteorStats {
  damageMultiplier: number;
  radius: number;
  cooldown: number;
  targetRange: 300;
  delay: .4;
  initialDelay: 1;
}

export function meteorStats(upgrades: Run['upgrades']): MeteorStats | null {
  const level = upgrades.meteor ?? 0;
  if (level <= 0) return null;
  const clamped = Math.min(3, level);
  return {
    damageMultiplier: [0, 1.8, 2.4, 3][clamped],
    radius: [0, 60, 70, 80][clamped] * (1 + (upgrades.reach ?? 0) * .18),
    cooldown: 5 * (1 - (upgrades.haste ?? 0) * .12),
    targetRange: 300,
    delay: .4,
    initialDelay: 1,
  };
}

function belowThreshold(hp: number, maxHp: number): boolean {
  return maxHp > 0 && hp / maxHp <= LOW_HEALTH_PERCENT / 100;
}

export function cullMultiplier(upgrades: Run['upgrades'], hp: number, maxHp: number, secondary = false): number {
  if (secondary || !belowThreshold(hp, maxHp)) return 1;
  return 1 + (upgrades.cull ?? 0) * CULL_DAMAGE_PERCENT / 100;
}

export function resolveMultiplier(upgrades: Run['upgrades'], hp: number, maxHp: number): number {
  if (!belowThreshold(hp, maxHp)) return 1;
  return 1 - (upgrades.resolve ?? 0) * RESOLVE_REDUCTION_PERCENT / 100;
}

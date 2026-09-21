import type { Profile } from './core.ts';
import type { UpgradeId } from './upgrades.ts';

export const CHARACTERS = {
  keeper: { name: '守燈旅人', requiredCleared: 0, startingUpgrades: { vitality: 1 } },
  scout: { name: '逐風斥候', requiredCleared: 1, startingUpgrades: { stride: 1 } },
  warden: { name: '苔紋守衛', requiredCleared: 2, startingUpgrades: { ward: 1 } },
} as const satisfies Record<string, { name: string; requiredCleared: number; startingUpgrades: Partial<Record<UpgradeId, number>> }>;

export type CharacterId = keyof typeof CHARACTERS;
export const DEFAULT_CHARACTER: CharacterId = 'keeper';
export function availableCharacters(profile: Profile): CharacterId[] {
  return (Object.keys(CHARACTERS) as CharacterId[]).filter(id=>profile.cleared>=CHARACTERS[id].requiredCleared);
}

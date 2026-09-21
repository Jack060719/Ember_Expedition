import type { Profile } from './core.ts';
import type { UpgradeId } from './upgrades.ts';

export const CHARACTERS = {
  keeper: { name: '守燈旅人', description: '帶著更充足的生命出發，在長夜中守住微光。', requiredCleared: 0, startingUpgrades: { vitality: 1 }, spritePath: '/assets/hero.png', textureKey: 'character-keeper', animationPrefix: 'character-keeper-walk-' },
  scout: { name: '逐風斥候', description: '以輕快步伐穿梭怪群，靈活走位尋找突破口。', requiredCleared: 1, startingUpgrades: { stride: 1 }, spritePath: '/assets/characters/scout.png', textureKey: 'character-scout', animationPrefix: 'character-scout-walk-' },
  warden: { name: '苔紋守衛', description: '以苔紋護甲減輕傷害，穩步迎向前方怪潮。', requiredCleared: 2, startingUpgrades: { ward: 1 }, spritePath: '/assets/characters/warden.png', textureKey: 'character-warden', animationPrefix: 'character-warden-walk-' },
} as const satisfies Record<string, { name: string; description: string; requiredCleared: number; startingUpgrades: Partial<Record<UpgradeId, number>>; spritePath: string; textureKey: string; animationPrefix: string }>;

export type CharacterId = keyof typeof CHARACTERS;
export const DEFAULT_CHARACTER: CharacterId = 'keeper';
export function availableCharacters(profile: Profile): CharacterId[] {
  return (Object.keys(CHARACTERS) as CharacterId[]).filter(id=>profile.cleared>=CHARACTERS[id].requiredCleared);
}

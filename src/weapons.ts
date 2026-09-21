import type { Profile } from './core.ts';
import type { UpgradeId } from './upgrades.ts';

export const WEAPONS = {
  staff: { name: '星火法杖', mark: '✦', detail: '雙發穿透火矢；進化後命中爆破，掃開成群敵人。', requiredForge: 0 },
  blade: { name: '逐風短劍', mark: '⟐', detail: '大範圍揮斬；進化後斬出穿透刀波。', requiredForge: 1 },
  halo: { name: '守燈光環', mark: '◎', detail: '環形脈衝護身；進化後雙重光環擴大清場。', requiredForge: 2 },
} as const;

export type Weapon = keyof typeof WEAPONS;
export const EVOLUTIONS: Record<Weapon, {name:string;description:string;requires:Partial<Record<UpgradeId,number>>}> = {
  staff:{name:'星隕法杖',description:'火矢增加、穿透命中引發範圍爆破',requires:{power:3,pierce:2}},
  blade:{name:'逐風裂空',description:'揮斬釋放穿透刀波，切開遠處怪群',requires:{power:3,reach:2}},
  halo:{name:'雙曜光環',description:'擴大脈衝並釋放外環，光刃數量增加',requires:{orbit:2,haste:2}},
};
export function availableWeapons(profile: Profile): Weapon[] {
  return (Object.keys(WEAPONS) as Weapon[]).filter(id=>profile.facilities.forge>=WEAPONS[id].requiredForge);
}

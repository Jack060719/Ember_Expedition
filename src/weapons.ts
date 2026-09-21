import type { Profile, Run } from './core.ts';
import type { UpgradeId } from './upgrades.ts';

export const WEAPONS = {
  staff: { name: '星火法杖', mark: '✦', detail: '雙發穿透火矢；進化後命中爆破，掃開成群敵人。', requiredForge: 0, damage:18, range:330, cooldown:.5 },
  blade: { name: '逐風短劍', mark: '⟐', detail: '大範圍揮斬；進化後斬出穿透刀波。', requiredForge: 1, damage:30, range:110, cooldown:.5 },
  halo: { name: '守燈光環', mark: '◎', detail: '環形脈衝護身；進化後雙重光環擴大清場。', requiredForge: 2, damage:18, range:95, cooldown:.55 },
  boomerang: { name: '迴風飛環', mark: '◈', detail: '飛環穿過怪群再飛回身旁，去回各命中一次；進化後回程傷害提高。工坊 3 級解鎖。', requiredForge: 3, damage:18, range:220, cooldown:.8, outwardSpeed:340, returnSpeed:420, hitLimit:3, evolvedHitLimit:5, evolvedReturnDamage:1.6 },
  hammer: { name: '震地戰錘', mark: '⚒', detail: '鎖定敵人位置後延遲落錘；分光擴大範圍，進化後再震擊一次。工坊 4 級解鎖。', requiredForge: 4, damage:48, range:180, cooldown:.9, radius:58, delay:.24, echoDelay:.18, echoDamage:.5 },
} as const;

export type Weapon = keyof typeof WEAPONS;
export const EVOLUTIONS: Record<Weapon, {name:string;description:string;requires:Partial<Record<UpgradeId,number>>}> = {
  staff:{name:'星隕法杖',description:'火矢增加、穿透命中引發範圍爆破',requires:{power:3,pierce:2}},
  blade:{name:'逐風裂空',description:'揮斬釋放穿透刀波，切開遠處怪群',requires:{power:3,reach:2}},
  halo:{name:'雙曜光環',description:'擴大脈衝並釋放外環，光刃數量增加',requires:{orbit:2,haste:2}},
  boomerang:{name:'巡天飛環',description:'飛環擴大，每段可命中五名敵人，回程傷害提高 60%；穿透可增加命中數',requires:{split:2,haste:3}},
  hammer:{name:'裂地戰錘',description:'落錘範圍擴大 20%，隨後產生 50% 傷害的餘震；餘震不暴擊或附加異常',requires:{power:3,reach:2}},
};
export function availableWeapons(profile: Profile): Weapon[] {
  return (Object.keys(WEAPONS) as Weapon[]).filter(id=>profile.facilities.forge>=WEAPONS[id].requiredForge);
}
export function weaponDamage(run:Run){
  const melee=run.weapon==='blade'||run.weapon==='halo'||run.weapon==='hammer';
  return WEAPONS[run.weapon].damage*(1+run.growth.damage)*(1+(run.upgrades.power??0)*.2+(run.upgrades.pierce??0)*(melee?.15:0));
}
export function skillDamage(run:Run){
  return run.weapon==='boomerang'||run.weapon==='hammer'?18*(1+run.growth.damage)*(1+(run.upgrades.power??0)*.2):weaponDamage(run);
}
export function weaponRange(run:Run,evolved:boolean){
  return WEAPONS[run.weapon].range*(1+(run.upgrades.reach??0)*.18)*(evolved&&run.weapon==='halo'?1.3:1);
}
export function weaponCooldown(run:Run){
  return WEAPONS[run.weapon].cooldown*(1-(run.upgrades.haste??0)*.12);
}

import { meteorStats, LOW_HEALTH_PERCENT, CULL_DAMAGE_PERCENT, RESOLVE_REDUCTION_PERCENT } from './ability-effects.ts';

export type UpgradeCategory = 'auto' | 'offense' | 'survival' | 'utility';
interface UpgradeDefinition { id: string; name: string; description: string; icon: string; max: number; color: string; category: UpgradeCategory; }

export const UPGRADES = [
  { id: 'power', name: '鍛火', description: '所有攻擊傷害 +20%', icon: '✧', max: 5, color: 'gold', category: 'offense' },
  { id: 'haste', name: '疾光', description: '普攻與自動技能冷卻縮短 12%', icon: '»', max: 4, color: 'blue', category: 'offense' },
  { id: 'stride', name: '輕靈步伐', description: '移動速度 +12%', icon: '⌁', max: 3, color: 'green', category: 'utility' },
  { id: 'vitality', name: '餘燼之心', description: '生命上限 +20，立刻恢復 20 生命', icon: '♡', max: 4, color: 'rose', category: 'survival' },
  { id: 'reach', name: '長明', description: '攻擊範圍 +18%', icon: '◌', max: 3, color: 'blue', category: 'offense' },
  { id: 'split', name: '分光', description: '法杖增加投射物；短劍擴大扇角；光環增加光刃', icon: '⋔', max: 3, color: 'gold', category: 'offense' },
  { id: 'pierce', name: '穿透', description: '投射物可多穿透一名敵人；近戰傷害 +15%', icon: '↗', max: 3, color: 'blue', category: 'offense' },
  { id: 'ember', name: '灼痕', description: '擊中使敵人燃燒，每秒受到額外傷害', icon: '♨', max: 3, color: 'rose', category: 'offense' },
  { id: 'frost', name: '霜息', description: '攻擊使敵人減速，持續 1.5 秒', icon: '❄', max: 3, color: 'blue', category: 'offense' },
  { id: 'storm', name: '連鎖閃電', description: '每 3 秒自動落雷，每級增加連鎖目標；Lv.2 搭配霜息 Lv.2 解鎖霜雷', icon: 'ϟ', max: 3, color: 'gold', category: 'auto' },
  { id: 'ward', name: '護燈者', description: '受到的傷害減少 12%', icon: '◇', max: 3, color: 'green', category: 'survival' },
  { id: 'mend', name: '回春', description: '每 8 秒自動恢復 2 生命', icon: '+', max: 3, color: 'green', category: 'survival' },
  { id: 'orbit', name: '伴星', description: '召喚繞行光刃；每級增加一片，持續切割周圍怪群', icon: '☄', max: 3, color: 'gold', category: 'auto' },
  { id: 'nova', name: '星爆', description: '每 4 秒向四周釋放震波；Lv.2 搭配灼痕 Lv.2 解鎖燃爆', icon: '✺', max: 3, color: 'rose', category: 'auto' },
  { id: 'magnet', name: '引光', description: '經驗吸取範圍 +55%', icon: '⊹', max: 2, color: 'blue', category: 'utility' },
  { id: 'fortune', name: '拾荒者', description: '房間火種收益 +20%', icon: '◈', max: 3, color: 'gold', category: 'utility' },
  { id: 'focus', name: '洞察', description: '暴擊機率 +12%，暴擊造成雙倍傷害', icon: '⊙', max: 3, color: 'rose', category: 'offense' },
  { id: 'secondwind', name: '不熄之火', description: '本次遠征可抵擋一次致命傷，恢復 40% 生命', icon: '♧', max: 1, color: 'green', category: 'survival' },
  { id: 'meteor', name: '星墜', description: '每 5 秒鎖定 300 範圍內敵人，延遲落下範圍攻擊', icon: '☄', max: 3, color: 'rose', category: 'auto' },
  { id: 'cull', name: '乘隙', description: `直接命中生命在 ${LOW_HEALTH_PERCENT}% 以下的敵人時傷害提高`, icon: '⌁', max: 3, color: 'rose', category: 'offense' },
  { id: 'resolve', name: '守燈決意', description: `自身生命在 ${LOW_HEALTH_PERCENT}% 以下時，承受傷害進一步降低`, icon: '◇', max: 3, color: 'green', category: 'survival' },
] as const satisfies readonly UpgradeDefinition[];

export type UpgradeId = typeof UPGRADES[number]['id'];
export type Upgrade = UpgradeDefinition & { id: UpgradeId };
export const AUTO_UPGRADES: readonly Upgrade[] = UPGRADES.filter(u=>u.category==='auto');

/** Returns the cumulative, player-facing effect at a particular level. */
export function upgradeDescription(id: UpgradeId, level: number): string {
  if (level <= 0) return '尚未取得';
  switch (id) {
    case 'power': return `所有攻擊傷害 +${level * 20}%`;
    case 'haste': return `普攻與自動技能冷卻縮短 ${level * 12}%`;
    case 'stride': return `移動速度 +${level * 12}%`;
    case 'vitality': return `生命上限 +${level * 20}，每級取得時恢復 20 生命`;
    case 'reach': return `攻擊範圍 +${level * 18}%`;
    case 'split': return `分光等級 ${level}：依武器增加投射物、扇角或光刃`;
    case 'pierce': return `投射物多穿透 ${level} 名敵人；近戰傷害 +${level * 15}%`;
    case 'ember': return `擊中使敵人燃燒 2 秒，每秒額外 ${level * 8} 傷害`;
    case 'frost': return `攻擊使敵人減速 ${level * 18}%，持續 1.5 秒`;
    case 'storm': return `每 3 秒落雷，最多連鎖 ${2 + level * 2} 個目標；Lv.2 搭配霜息 Lv.2 解鎖霜雷`;
    case 'ward': return `受到的傷害減少 ${level * 12}%`;
    case 'mend': return `每 8 秒恢復 ${level * 2} 生命`;
    case 'orbit': return `召喚 ${1 + level} 片繞行光刃`;
    case 'nova': return `每 4 秒釋放震波，半徑 ${125 + level * 20}；Lv.2 搭配灼痕 Lv.2 解鎖燃爆`;
    case 'magnet': return `經驗吸取範圍 +${level * 55}%`;
    case 'fortune': return `房間火種收益 +${level * 20}%`;
    case 'focus': return `暴擊機率 +${level * 12}%，暴擊造成雙倍傷害`;
    case 'secondwind': return '本次遠征抵擋一次致命傷，恢復 40% 生命';
    case 'meteor': {
      const stats = meteorStats({ meteor: level })!;
      return `每 ${stats.cooldown} 秒鎖定 ${stats.targetRange} 範圍內最近敵人的位置，${stats.delay} 秒後落擊；傷害為技能基準的 ${stats.damageMultiplier} 倍，半徑 ${stats.radius}（長明擴大範圍、疾光縮短冷卻；首次 ${stats.initialDelay} 秒）`;
    }
    case 'cull': return `命中前目標生命在 ${LOW_HEALTH_PERCENT}% 以下時，直接傷害 +${level * CULL_DAMAGE_PERCENT}%（燃燒、連爆與餘震不加成）`;
    case 'resolve': return `自身生命在 ${LOW_HEALTH_PERCENT}% 以下時，承傷另外減少 ${level * RESOLVE_REDUCTION_PERCENT}%（與護燈者相乘）`;
  }
}

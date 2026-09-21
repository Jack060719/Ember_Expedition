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
] as const satisfies readonly UpgradeDefinition[];

export type UpgradeId = typeof UPGRADES[number]['id'];
export type Upgrade = UpgradeDefinition & { id: UpgradeId };
export const AUTO_UPGRADES: readonly Upgrade[] = UPGRADES.filter(u=>u.category==='auto');

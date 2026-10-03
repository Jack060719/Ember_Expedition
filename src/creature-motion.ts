import type { ChapterAttack } from './chapter-attacks.ts';

export const PET_WINDUP=.28;
export const ATTACK_RELEASE=.14;
export const ATTACK_RECOVERY=.22;
export const PET_ATTACK_DURATION=PET_WINDUP+ATTACK_RELEASE+ATTACK_RECOVERY;
export function playerMoveSpeed(stride:number){return 128*(1+stride*.12);}
export function petMoveSpeed(stride:number){return playerMoveSpeed(stride)*.9;}
export function attackFrame(elapsed:number,windup:number){
  return elapsed<windup/2?4:elapsed<windup?5:elapsed<windup+ATTACK_RELEASE?6:7;
}
export function advancePetAttack(previous:number,dt:number){
  const elapsed=Math.min(PET_ATTACK_DURATION,previous+dt);
  return {elapsed,frame:attackFrame(elapsed,PET_WINDUP),release:previous<PET_WINDUP&&elapsed>=PET_WINDUP,done:elapsed>=PET_ATTACK_DURATION};
}
export function chapterAttackFrame(plan:ChapterAttack,elapsed:number){
  const dash=plan.dash;
  if(dash&&elapsed>=dash.start&&elapsed<dash.start+dash.duration)return 6;
  const releases=plan.areas.map(a=>a.delay),past=releases.filter(t=>t<=elapsed),future=releases.filter(t=>t>elapsed);
  const last=past.length?Math.max(...past):null;
  if(last!==null&&elapsed-last<ATTACK_RELEASE+ATTACK_RECOVERY)return attackFrame(elapsed-last,0);
  if(dash&&elapsed>=dash.start+dash.duration&&elapsed<dash.start+dash.duration+ATTACK_RECOVERY)return 7;
  if(future.length){const start=last===null?0:last+ATTACK_RELEASE+ATTACK_RECOVERY;return attackFrame(elapsed-start,Math.min(...future)-start);}
  return 0;
}

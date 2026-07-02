// ===================================================================
//  lib/game-core/data/team-names.ts — NBA 球队中文名映射
// ===================================================================

/** 球队缩写 → 中文名（不带地名） */
export const TEAM_CN: Record<string, string> = {
  ATL: "老鹰",
  BKN: "篮网",
  BOS: "凯尔特人",
  CHA: "黄蜂",
  CHI: "公牛",
  CLE: "骑士",
  DAL: "独行侠",
  DEN: "掘金",
  DET: "活塞",
  GSW: "勇士",
  HOU: "火箭",
  IND: "步行者",
  LAC: "快船",
  LAL: "湖人",
  MEM: "灰熊",
  MIA: "热火",
  MIL: "雄鹿",
  MIN: "森林狼",
  NOP: "鹈鹕",
  NYK: "尼克斯",
  OKC: "雷霆",
  ORL: "魔术",
  PHI: "76人",
  PHX: "太阳",
  POR: "开拓者",
  SAC: "国王",
  SAS: "马刺",
  TOR: "猛龙",
  UTA: "爵士",
  WAS: "奇才",
};

/** 获取球队中文名，不存在则返回缩写本身 */
export function teamCN(abbr: string): string {
  return TEAM_CN[abbr] || abbr;
}

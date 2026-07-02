// ===================================================================
//  lib/game-core/data/team-colors.ts — NBA 球队主色/辅色
// ===================================================================

/** 球队缩写 → [主色, 辅色] */
export const TEAM_COLORS: Record<string, [string, string]> = {
  ATL: ["#b42b33", "#c76169"],
  BKN: ["#c6c6c6", "#505050"],
  BOS: ["#488a50", "#223425"],
  CHA: ["#25225a", "#384a7b"],
  CHI: ["#d93831", "#da2f2e"],
  CLE: ["#860038", "#BC945C"],
  DAL: ["#2d6ab7", "#c5cdd4"],
  DEN: ["#418fde", "#418fde"],
  DET: ["#c42e47", "#254f9d"],
  GSW: ["#eeba4b", "#283f85"],
  HOU: ["#ad342c", "#ffffff"],
  IND: ["#eac962", "#142356"],
  LAC: ["#002650", "#0b3666"],
  LAL: ["#f1bc4b", "#50247c"],
  MEM: ["#14163b", "#5d75ad"],
  MIA: ["#a32a2e", "#261c22"],
  MIL: ["#dcd4b4", "#304c38"],
  MIN: ["#b6c8d3", "#244f7d"],
  NOP: ["#ae9b6d", "#ae9b6d"],
  NYK: ["#d86a34", "#1c399f"],
  OKC: ["#4876b6", "#1c233d"],
  ORL: ["#3053ad", "#3053ae"],
  PHI: ["#3063b0", "#2f61af"],
  PHX: ["#f6ca57", "#c86d36"],
  POR: ["#ab2f32", "#6a1d1f"],
  SAC: ["#55277f", "#3a0e63"],
  SAS: ["#c7cdd4", "#34393d"],
  TOR: ["#a2a2a4", "#b12a32"],
  UTA: ["#15203e", "#14223e"],
  WAS: ["#16213d", "#bd2a33"],
};

/** 获取球队颜色，不存在则返回默认色 */
export function getTeamColors(abbr: string): [string, string] {
  return TEAM_COLORS[abbr] || ["#888888", "#444444"];
}

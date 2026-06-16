// ===================================================================
//  leaderboard/utils.js — 纯工具函数
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  ns.Utils = {

    escapeHtml: function(str) {
      if (!str) return "";
      var d = document.createElement("div");
      d.appendChild(document.createTextNode(str));
      return d.innerHTML;
    },

    /** Supabase text[] / JSON 字符串 → JS array */
    toArray: function(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        // JSON 数组格式：["a","b"]（text 列存入的 JSON 串）
        if (val.charAt(0) === "[") {
          try { var arr = JSON.parse(val); return Array.isArray(arr) ? arr : []; } catch(e) {}
        }
        // PostgreSQL text[] 格式：{a,b} 或 {"a","b"}
        var s = val.replace(/^\{|\}$/g, "");
        return s ? s.split(",").map(function(x) { return x.replace(/^"/,"").replace(/"$/,""); }) : [];
      }
      return [];
    },

    timeAgo: function(iso) {
      var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diff < 60)    return "刚刚";
      if (diff < 3600)  return Math.floor(diff / 60) + " 分钟前";
      if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
      if (diff < 604800)return Math.floor(diff / 86400) + " 天前";
      var d = new Date(iso);
      return (d.getMonth() + 1) + "/" + d.getDate();
    },

    todayISO: function() {
      var d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
    },

    weekStartISO: function() {
      var d = new Date(), day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      d.setHours(0,0,0,0);
      return d.toISOString();
    },

    getRoster: function() {
      return ["PG","SG","SF","PF","C"].map(function(pos) {
        var p = game.slots[pos];
        if (!p) return null;
        // 保留 playerRating() 需要的全部字段
        return {
          name: p.name, decade: p.decade, team: p.team,
          pos: p.pos, positions: p.positions,
          pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk
        };
      }).filter(Boolean);
    },

    /** 阵容哈希 — 排序拼接后 djb2，避免中文名进入 URL 导致 404 */
    rosterHash: function(playerNames) {
      var sorted = playerNames.slice().sort().join("|");
      var hash = 5381;
      for (var i = 0; i < sorted.length; i++) {
        hash = ((hash << 5) + hash) + sorted.charCodeAt(i);
        hash |= 0;
      }
      return "rh_" + (hash >>> 0).toString(36);
    },

    calcScore: function(wins, roster) {
      var sum = 0;
      roster.forEach(function(p) { sum += playerRating(p) || 0; });
      return Math.round(wins * 10 + (roster.length ? sum / roster.length : 0));
    }

  };

})(BB82);

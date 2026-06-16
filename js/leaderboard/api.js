// ===================================================================
//  leaderboard/api.js — Supabase 数据访问层
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var C = ns.CONFIG, U = ns.Utils;

  ns.API = {

    _t: function() { var sb = ns.Supabase.get(); return sb ? sb.from(C.TABLE) : null; },

    // ── 写入 ────────────────────────────────────────────────────────
    insert: function(row) {
      row.share_code = row.share_code || ns.API.generateShareCode();
      // 仅在明确提供了 user_id 时才写入（NULL 表示未认证，避免 UUID 类型冲突）
      if (!row.user_id) delete row.user_id;
      return this._t().insert(row).select("id,share_code").single();
    },

    // ── 排行榜查询 ──────────────────────────────────────────────────
    fetchAllWins: function(period) {
      period = period || "all";
      var q = this._t().select("wins").limit(5000);
      if (period === "today") q = q.gte("created_at", U.todayISO());
      if (period === "week")  q = q.gte("created_at", U.weekStartISO());
      return q;
    },

    fetchTopInRange: function(wMin, wMax, period, limit) {
      period = period || "all"; limit = limit || 5;
      var q = this._t().select("*").gte("wins", wMin).lte("wins", wMax)
        .order("wins", { ascending: false }).order("created_at", { ascending: true }).limit(limit);
      if (period === "today") q = q.gte("created_at", U.todayISO());
      if (period === "week")  q = q.gte("created_at", U.weekStartISO());
      return q;
    },

    fetchLeaderboard: function(period, limit) {
      period = period || "all"; limit = limit || C.LB_LIMIT;
      var q = this._t().select("*").order("wins", { ascending: false }).order("created_at", { ascending: true }).limit(limit);
      if (period === "today") q = q.gte("created_at", U.todayISO());
      if (period === "week")  q = q.gte("created_at", U.weekStartISO());
      return q;
    },

    // ── 用户记录（基于 auth.uid()）──────────────────────────────────
    fetchMyRecords: function() {
      var uid = ns.Auth ? ns.Auth.userId : null;
      if (!uid) return Promise.resolve({ data: [] });
      return this._t().select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50);
    },

    /** 修改昵称时同步所有该用户的记录 */
    updateNicknameByUser: function(newName) {
      var uid = ns.Auth ? ns.Auth.userId : null;
      if (!uid) return Promise.resolve(null);
      return this._t().update({ username: newName }).eq("user_id", uid);
    },

    // ── 游客迁移：指纹 → user_id ────────────────────────────────────
    migrateFingerprintToUser: function(fp) {
      var uid = ns.Auth ? ns.Auth.userId : null;
      if (!uid || !fp) return Promise.resolve(null);
      return this._t().update({ user_id: uid }).eq("client_fingerprint", fp).is("user_id", null);
    },

    // ── 分享 ────────────────────────────────────────────────────────
    fetchById: function(id) { return this._t().select("*").eq("id", id).single(); },
    fetchByShareCode: function(code) { return this._t().select("*").eq("share_code", code).single(); },

    // ── 防刷查询（指纹作为辅助）─────────────────────────────────────
    latestByUser: function() {
      var uid = ns.Auth ? ns.Auth.userId : null;
      if (!uid) return Promise.resolve({ data: [] });
      return this._t().select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1);
    },
    latestByFingerprint: function(fp) {
      return this._t().select("created_at").eq("client_fingerprint", fp).order("created_at", { ascending: false }).limit(1);
    },
    latestByUsername: function(name) {
      return this._t().select("created_at").eq("username", name).order("created_at", { ascending: false }).limit(1);
    },
    latestByPlayers: function(playerNames) {
      return this._t().select("created_at").eq("roster_hash", ns.Utils.rosterHash(playerNames)).order("created_at", { ascending: false }).limit(1);
    },

    // ── 工具 ────────────────────────────────────────────────────────
    generateShareCode: function() {
      var chars = "abcdefghijklmnopqrstuvwxyz0123456789", code = "", arr = new Uint32Array(12);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
        for (var i = 0; i < 12; i++) code += chars[arr[i] % chars.length];
      } else {
        for (var j = 0; j < 12; j++) code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    }

  };

})(BB82);

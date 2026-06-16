// ===================================================================
//  leaderboard/submit.js — 提交业务逻辑（输入消毒 + 防刷编排）
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var C = ns.CONFIG, U = ns.Utils, S = ns.Storage, F = ns.Fingerprint, A = ns.API, AS = ns.AntiSpam, UI = ns.UI;
  var Auth = ns.Auth;

  function sanitize(str, maxLen) {
    if (typeof str !== "string") return "";
    return str.replace(/[<>]/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, maxLen).trim();
  }

  function buildRecordStr(wins) { return String(wins) + "-" + String(82 - wins); }

  ns.Submit = {

    auto: function(players, wins, recordStr, totalScore, onComplete, skipAntiSpam) {
      // 仅开发模式可跳过防刷
      if (skipAntiSpam && !ns.DEV.active()) skipAntiSpam = false;
      var name = S.nickname;
      if (!name) {
        UI.Nickname.show("🏀 设置你的昵称", "设置一次，后续自动上传", function(n) {
          ns.Submit._exec(players, wins, recordStr, totalScore, n, onComplete, skipAntiSpam);
        });
      } else {
        ns.Submit._exec(players, wins, recordStr, totalScore, name, onComplete, skipAntiSpam);
      }
    },

    _exec: function(players, wins, recordStr, totalScore, username, onComplete, skipAntiSpam) {
      // 仅开发模式可跳过防刷
      if (skipAntiSpam && !ns.DEV.active()) skipAntiSpam = false;
      var done = onComplete || function(){};

      username = sanitize(username, C.MAX_USERNAME_LEN) || "匿名球迷";
      players = players.map(function(p) {
        return {
          name: sanitize(p.name, C.MAX_PLAYERNAME_LEN), decade: sanitize(p.decade, C.MAX_DECADE_LEN), team: sanitize(p.team, C.MAX_TEAM_LEN),
          pos: p.pos, positions: p.positions, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk
        };
      }).filter(function(p) { return p.name && p.decade && p.team; });
      if (players.length < 5) { done(false, "阵容数据不完整"); return; }

      recordStr = sanitize(recordStr, C.MAX_RECORD_LEN);
      if (!/^\d{1,3}-\d{1,3}$/.test(recordStr) || parseInt(recordStr.split("-")[0], 10) !== wins) {
        recordStr = buildRecordStr(wins);
      }

      var pNames = players.map(function(p){ return p.name; });
      var decades = players.map(function(p){ return p.decade; });
      var teams   = players.map(function(p){ return p.team; });

      // ── 开发模式快速通道 ──────────────────────────────────
      if (skipAntiSpam) {
        Promise.all([Auth.wait(), F.get()]).then(function(results) {
          var uid = results[0], fp = results[1];
          var row = {
            player_names: pNames, decades: decades, teams: teams,
            wins: wins, record: recordStr, total_score: totalScore,
            username: username, client_fingerprint: fp,
            roster_hash: U.rosterHash(pNames)
          };
          if (uid) row.user_id = uid;
          A.insert(row).then(function(res) {
            if (res.error) { done(false, "上传失败"); return; }
            S.lastSubmitTs = Date.now(); S.lastSubmitFp = fp;
            done(true, "上传成功");
          });
        });
        return;
      }

      // ── 客户端校验 ─────────────────────────────────────────
      var check = AS.checkClient(wins, players);
      if (!check.ok) { done(false, check.reason); return; }

      // ── 服务端防刷（user_id 为主，指纹为辅）───────────────
      Promise.all([Auth.wait(), F.get()]).then(function(results) {
        var uid = results[0];  // null if auth failed
        var fp  = results[1];

        var lastTs = S.lastSubmitTs;
        if (lastTs > 0 && (Date.now() - lastTs) < C.COOLDOWN_FP_MS) {
          done(false, "提交太频繁"); return;
        }

        AS.checkServer(pNames, username, uid || fp, fp, function(srv) {
          if (!srv.ok) { done(false, srv.reason); return; }

          var row = {
            player_names: pNames, decades: decades, teams: teams,
            wins: wins, record: recordStr, total_score: totalScore,
            username: username, client_fingerprint: fp,
            roster_hash: U.rosterHash(pNames)
          };
          if (uid) row.user_id = uid;

          A.insert(row).then(function(res) {
            if (res.error) { done(false, "上传失败"); return; }
            S.lastSubmitTs = Date.now(); S.lastSubmitFp = fp;
            done(true, "上传成功");
          });
        });
      });
    }

  };

})(BB82);

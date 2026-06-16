// ===================================================================
//  leaderboard/antispam.js — 防刷校验（用户 ID + 指纹辅助）
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var C = ns.CONFIG, S = ns.Storage, A = ns.API;

  ns.AntiSpam = {

    _inCooldown: function(res, ms) {
      if (res.error || !res.data || !res.data.length) return false;
      return (Date.now() - new Date(res.data[0].created_at).getTime()) < ms;
    },

    checkClient: function(wins, roster) {
      if (typeof wins !== "number" || wins < 0 || wins > 82 || !Number.isInteger(wins))
        return { ok: false, reason: "数据异常" };
      if (roster.length === 5) {
        var ratings = roster.map(function(p) { return playerRating(p) || 0; });
        var product = ratings.reduce(function(a,b){ return a*b; }, 1);
        var geoMean = Math.pow(product, 1/5);
        var teamOvr = Math.round(geoMean * 1.1 * 10) / 10;
        var maxWins = Math.round(82 * Math.pow(Math.min(teamOvr/110, 1), 2.2));
        if (maxWins === 64) maxWins = 65; if (maxWins === 18) maxWins = 17; if (maxWins === 54) maxWins = 55;
        if (wins > maxWins + 3) return { ok: false, reason: "数据异常" };
      }
      return { ok: true };
    },

    /** 服务端级联：user → fingerprint → username → roster */
    checkServer: function(playerNames, username, uid, fp, callback) {
      var self = this;

      // 1. 同 user_id 30s
      A.latestByUser(uid).then(function(r) {
        if (self._inCooldown(r, C.COOLDOWN_FP_MS))
          return callback({ ok: false, reason: "提交太频繁，请30秒后再试" });

        // 2. 同指纹 30s（兜底，覆盖未登录场景）
        A.latestByFingerprint(fp).then(function(rf) {
          if (self._inCooldown(rf, C.COOLDOWN_FP_MS))
            return callback({ ok: false, reason: "提交太频繁，请30秒后再试" });

          // 3. 同昵称 2min
          A.latestByUsername(username).then(function(rn) {
            if (self._inCooldown(rn, C.COOLDOWN_NAME_MS))
              return callback({ ok: false, reason: "该昵称2分钟内已提交" });

            // 4. 同阵容 5min
            A.latestByPlayers(playerNames).then(function(rp) {
              if (self._inCooldown(rp, C.COOLDOWN_ROSTER_MS))
                return callback({ ok: false, reason: "相同阵容已提交" });
              callback({ ok: true });
            });
          });
        });
      });
    }

  };

})(BB82);

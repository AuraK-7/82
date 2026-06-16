// ===================================================================
//  leaderboard/init.js — 公共 API 组装 + window 绑定 + DOM 初始化
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  console.log("82-0 联网功能已启用");

  // ── 公开 API ────────────────────────────────────────────────────
  ns.showLeaderboard   = function() { ns.UI.Leaderboard.open(); };
  ns.closeLeaderboard  = function() { ns.UI.Leaderboard.close(); };
  ns.changeNickname    = function(onDone) { ns.UI.Nickname.show("✏️ 修改昵称", "修改后新战绩使用新昵称", onDone); };
  ns.openProfile       = function() { ns.UI.Profile.open(); };
  ns.shareRecord       = function(code, name, wins) { ns.Share.record(code, name, wins); };
  ns.continueSameMode  = function() { ns.Game.continueMode(); };

  // ── window 挂载 ──────────────────────────────────────────────────
  window.showLeaderboard  = ns.showLeaderboard;
  window.closeLeaderboard = ns.closeLeaderboard;
  window.changeNickname   = ns.changeNickname;
  window.openProfile      = ns.openProfile;
  window.shareRecord      = ns.shareRecord;
  window.continueSameMode = ns.continueSameMode;

  // ── 开发模式 ──────────────────────────────────────────────────
  if (ns.DEV.active()) {
    console.log("[82-0] 🛠 开发模式已启用");

    ns.testSubmit = function() {
      var pool = [
        { n:"勒布朗·詹姆斯",    d:"2010s", t:"LAL" },{ n:"詹姆斯·哈登",      d:"2010s", t:"HOU" },
        { n:"凯文·杜兰特",      d:"2010s", t:"GSW" },{ n:"拉塞尔·威斯布鲁克",d:"2010s", t:"OKC" },
        { n:"科怀·伦纳德",      d:"2010s", t:"TOR" },{ n:"扬尼斯·阿德托昆博",d:"2010s", t:"MIL" },
        { n:"卢卡·东契奇",      d:"2020s", t:"DAL" },{ n:"杰森·塔图姆",      d:"2020s", t:"BOS" },
        { n:"尼古拉·约基奇",    d:"2020s", t:"DEN" },{ n:"乔尔·恩比德",      d:"2020s", t:"PHI" },
        { n:"斯蒂芬·库里",      d:"2010s", t:"GSW" },{ n:"克莱·汤普森",      d:"2010s", t:"GSW" },
        { n:"凯里·欧文",        d:"2010s", t:"BKN" },{ n:"达米安·利拉德",    d:"2010s", t:"POR" },
        { n:"迈克尔·乔丹",      d:"1990s", t:"CHI" },{ n:"斯科蒂·皮蓬",      d:"1990s", t:"CHI" },
        { n:"魔术师·约翰逊",    d:"1980s", t:"LAL" },{ n:"拉里·伯德",        d:"1980s", t:"BOS" },
        { n:"哈基姆·奥拉朱旺",  d:"1990s", t:"HOU" },{ n:"沙奎尔·奥尼尔",    d:"1990s", t:"LAL" },
        { n:"蒂姆·邓肯",        d:"2000s", t:"SAS" },{ n:"科比·布莱恩特",    d:"2000s", t:"LAL" },
        { n:"卡尔·马龙",        d:"1990s", t:"UTA" },{ n:"约翰·斯托克顿",    d:"1990s", t:"UTA" },
        { n:"查尔斯·巴克利",    d:"1990s", t:"PHX" },{ n:"大卫·罗宾逊",      d:"1990s", t:"SAS" },
        { n:"贾巴尔",           d:"1970s", t:"MIL" },{ n:"张伯伦",            d:"1960s", t:"LAL" },
        { n:"比尔·拉塞尔",      d:"1960s", t:"BOS" },{ n:"德克·诺维茨基",    d:"2000s", t:"DAL" }
      ];
      var posns = ["PG","SG","SF","PF","C"];
      var shuffled = pool.slice().sort(function(){ return Math.random() - 0.5; });
      var picked = shuffled.slice(0, 5);
      var wins = Math.floor(Math.random() * 83);
      var record = wins + "-" + (82 - wins);
      var players = posns.map(function(pos, i) {
        var p = picked[i];
        return {
          name: p.n, decade: p.d, team: p.t,
          pos: pos, positions: [pos],
          pts: 15 + Math.floor(Math.random() * 15),
          reb: 3 + Math.floor(Math.random() * 10),
          ast: 2 + Math.floor(Math.random() * 10),
          stl: Math.floor(Math.random() * 4),
          blk: Math.floor(Math.random() * 4)
        };
      });
      var totalScore = ns.Utils.calcScore(wins, players);
      ns.Submit.auto(players, wins, record, totalScore, function(ok, msg) {
        ns.UI.Toast.show(ok ? "✅ " + msg + " | " + wins + "胜" : "❌ " + msg, ok ? "info" : "error");
      }, true);
    };
    window.testSubmit = ns.testSubmit;

    // 动态注入测试按钮到菜单
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(function() {
        var container = document.querySelector(".menu-buttons");
        if (!container) return;
        var btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        btn.textContent = "🧪 快速测试";
        btn.onclick = function() { ns.testSubmit(); };
        btn.style.cssText = "width:100%;max-width:280px;justify-content:center;border-color:var(--danger);color:var(--danger);";
        // 插入到排行榜按钮前面
        var lbBtn = container.querySelector("[onclick*='showLeaderboard']");
        if (lbBtn) container.insertBefore(btn, lbBtn);
        else container.appendChild(btn);
      }, 200);
    });
  }

  // ── DOM 初始化（Auth 优先）───────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function() {

    // 个人中心按钮仅在首页显示
    (function() {
      if (typeof showScreen !== "function") return;
      var _orig = showScreen;
      showScreen = function(id) {
        _orig(id);
        var btn = document.getElementById("profileBtn");
        if (btn) btn.style.display = (id === "screen-menu") ? "" : "none";
      };
    })();

    // Step 1: 认证（匿名登录 → 持久 UUID）
    ns.Auth.init().then(function(uid) {
      console.log("[82-0] Auth ready, user:", uid.slice(0, 8) + "...");

      // Step 2: 指纹预热
      ns.Fingerprint.get();

      // Step 3: 迁移游客数据（指纹记录 → user_id）
      ns.Fingerprint.get().then(function(fp) {
        ns.API.migrateFingerprintToUser(fp).then(function(r) {
          if (!r.error) console.log("[82-0] Guest migration OK");
        });
      });

      // Step 4: 分享链接入口
      setTimeout(function(){ ns.Share.checkEntry(); }, 500);

      // Step 5: 游戏模拟钩子
      ns.Game.installHook();
    }).catch(function() {
      // Auth 失败也不阻塞游戏，用指纹兜底
      ns.Fingerprint.get();
      setTimeout(function(){ ns.Share.checkEntry(); }, 500);
      ns.Game.installHook();
    });
  });

})(BB82);

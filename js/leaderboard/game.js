// ===================================================================
//  leaderboard/game.js — 游戏集成：模式追踪 + 自动上传钩子
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var U = ns.Utils, Sub = ns.Submit, UI = ns.UI;

  ns.Game = {

    _detectMode: function() {
      if (typeof _salaryMode !== "undefined" && _salaryMode) return "salary";
      if (typeof _cheatMode  !== "undefined" && _cheatMode)  return "cheat";
      var m = (typeof game !== "undefined" && game._modeName) || "";
      if (m === "自选模式")   return "custom";
      if (m === "工资帽模式") return "salary";
      if (m === "年代穿越")   return "era-cross";
      if (m === "同队传奇")   return "same-team";
      if (m === "国际阵容")   return "no-repeat";
      return "classic";
    },

    /** 结算页"再来一局" */
    continueMode: function() {
      switch (this._detectMode()) {
        case "classic":   startGame();      break;
        case "cheat":     startCheatGame(); break;
        case "custom":    enterCustomMode(); break;
        case "salary":    enterSalaryCapMode(); break;
        case "era-cross": showMenu(); setTimeout(function(){ enterEraChallenge(); },300);     break;
        case "same-team": showMenu(); setTimeout(function(){ enterTeamChallenge(); },300);     break;
        case "no-repeat": showMenu(); setTimeout(function(){ enterNoRepeatChallenge(); },300); break;
        default:          startGame();
      }
    },

    /** 自动上传当前结算结果（全量上传） */
    autoUpload: function() {
      var el = document.getElementById("finalRecord");
      if (!el) return;
      var wins = parseInt((el.textContent||"").split("-")[0], 10);
      if (isNaN(wins)) return;
      var roster = U.getRoster();
      if (roster.length < 5) return;
      Sub.auto(roster, wins, el.textContent, U.calcScore(wins, roster), function(ok, msg) {
        UI.UploadedHint.show(ok, msg);
      });
    },

    /** 安装模拟钩子 */
    installHook: function() {
      if (typeof runSimulation !== "function") return;
      var _orig = runSimulation, self = this;
      runSimulation = function() {
        window._lastGameMode = self._detectMode();
        _orig();
        setTimeout(function(){ self.autoUpload(); }, 150);
      };
    }

  };

})(BB82);

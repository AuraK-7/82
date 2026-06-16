// ===================================================================
//  leaderboard/share.js — 分享链接 (?code=xxx) + 查看
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var U = ns.Utils, A = ns.API, UI = ns.UI;

  ns.Share = {

    buildUrl: function(shareCode) {
      return window.location.origin + window.location.pathname + "?code=" + shareCode;
    },

    /** 查看阵容详情（弹窗） */
    view: function(r) {
      var self = this;
      var overlay = this._buildOverlay("🏀 阵容详情");
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) self._closeView(); });
      document.getElementById("sharedRecordBody").innerHTML = this._renderView(r);
    },

    /** 分享排行榜记录（使用 share_code 而非自增 id） */
    record: function(shareCode, username, wins) {
      var url = this.buildUrl(shareCode);
      UI.Clipboard.copy(url);
      UI.Toast.show("🔗 分享链接已复制！", "success");

      if (navigator.share) {
        setTimeout(function() {
          navigator.share({ title: username+" 在82-0挑战中取得"+wins+"胜！", text: "我组了一套"+wins+"胜的阵容🏀", url: url }).catch(function(){});
        }, 500);
      }
    },

    /** 页面加载时检测 ?code=xxx */
    checkEntry: function() {
      var p = new URLSearchParams(window.location.search);
      var code = p.get("code");
      var rid  = p.get("recordId"); // 向后兼容旧链接

      if (!code && !rid) return;
      if (code) { this._loadByCode(code); return; }
      if (rid)  { this._loadByLegacyId(rid); return; }
    },

    _loadByCode: function(code) {
      // 清理地址栏分享码
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, "", window.location.origin + window.location.pathname);
      }
      var self = this;
      var overlay = this._buildOverlay();
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) self._closeView(); });

      A.fetchByShareCode(code).then(function(res) {
        var body = document.getElementById("sharedRecordBody");
        if (!body) return;
        if (res.error||!res.data) { body.innerHTML = '<div class="lb-empty">😵 未找到该阵容记录</div>'; return; }
        body.innerHTML = self._renderView(res.data);
      });
    },

    _loadByLegacyId: function(id) {
      var self = this;
      var overlay = this._buildOverlay();
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) self._closeView(); });

      A.fetchById(id).then(function(res) {
        var body = document.getElementById("sharedRecordBody");
        if (!body) return;
        if (res.error||!res.data) { body.innerHTML = '<div class="lb-empty">😵 未找到该阵容记录</div>'; return; }
        var r = res.data;
        // 如果有 share_code，更新 URL 为新格式
        if (r.share_code) {
          var newUrl = self.buildUrl(r.share_code);
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, "", newUrl);
          }
        }
        body.innerHTML = self._renderView(r);
      });
    },

    _buildOverlay: function(title) {
      var o = document.createElement("div");
      o.id = "sharedRecordOverlay"; o.className = "modal-overlay lb-overlay";
      o.style.cssText = "display:flex;z-index:10000;";
      o.innerHTML =
        '<div class="lb-modal">'+
        '  <div class="lb-header"><h2 class="lb-title">' + (title || "🏀 阵容分享") + '</h2><button class="lb-close-btn" onclick="BB82.Share._closeView()">✕</button></div>'+
        '  <div class="lb-body" id="sharedRecordBody"><div class="lb-loading"><div class="lb-spinner"></div><p>加载中...</p></div></div>'+
        '  <div class="lb-footer">'+
        '    <button class="btn btn-gold btn-sm" onclick="BB82.Share._closeView();handleStartGame();" style="min-width:140px;">🎮 我也来挑战</button>'+
        '    <button class="btn btn-secondary btn-sm" onclick="BB82.Share._closeView()">关闭</button></div></div>';
      return o;
    },

    _closeView: function() { var o=document.getElementById("sharedRecordOverlay"); if(o) o.remove(); },

    _renderView: function(r) {
      var names = U.toArray(r.player_names), decades = U.toArray(r.decades), teams = U.toArray(r.teams);
      var slots = "";
      for (var i=0;i<5;i++) {
        var nm=names[i]?String(names[i]).split("-").pop():"—", tm=teams[i]||"", dc=decades[i]||"";
        var cl = TEAM_COLORS[tm]||["#333","#555"];
        var st = tm ? "background:linear-gradient(135deg,"+cl[0]+","+(cl[1]||cl[0])+");border-color:"+cl[0]+";box-shadow:0 0 12px "+cl[0]+"66;" : "background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1);";
        slots += '<div class="pos-slot filled" style="'+st+'"><span class="slot-player-name">'+U.escapeHtml(nm)+'</span><span class="slot-team-decade">'+(tm?teamCN(tm)+" · "+dc:"—")+'</span></div>';
      }
      var gc = r.wins>=82?"#f1c40f":r.wins>=72?"#22c55e":r.wins>=62?"#22c55e":r.wins>=50?"#3b82f6":"#f59e0b";
      return [
        '<div style="text-align:center;padding:8px 0;">',
        '  <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">'+U.escapeHtml(r.username||"匿名球迷")+' 的阵容</div>',
        '  <div style="font-size:clamp(2.5rem,6vw,3.5rem);font-weight:900;color:'+gc+';">'+r.wins+' 胜</div>',
        '  <div style="font-size:0.85rem;color:var(--text-muted);">'+U.escapeHtml(r.record||"")+'</div></div>',
        '<div class="pos-slots" style="margin-top:16px;"><div class="pos-slots-row" style="justify-content:center;">'+slots+'</div></div>',
        r.created_at?'<div style="text-align:center;font-size:0.7rem;color:var(--text-muted);margin-top:12px;">'+U.timeAgo(r.created_at)+'</div>':""
      ].join("");
    }

  };

})(BB82);

// ===================================================================
//  leaderboard/ui.js — UI 组件：Toast / Clipboard / Nickname / Leaderboard / UploadedHint
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var C = ns.CONFIG, U = ns.Utils, S = ns.Storage, A = ns.API, F = ns.Fingerprint;

  // ── Toast ──────────────────────────────────────────────────────────
  ns.UI = {};

  ns.UI.Toast = {
    show: function(msg, type) {
      var old = document.querySelector(".lb-toast"); if (old) old.remove();
      var el = document.createElement("div");
      el.className = "lb-toast lb-toast-" + (type || "info");
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(function(){ el.classList.add("show"); }, 10);
      setTimeout(function(){ el.classList.remove("show"); setTimeout(function(){ el.remove(); }, 300); }, 2500);
    }
  };

  // ── Clipboard ──────────────────────────────────────────────────────
  ns.UI.Clipboard = {
    copy: function(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function(){ ns.UI.Clipboard._fb(text); });
      } else { ns.UI.Clipboard._fb(text); }
    },
    _fb: function(text) {
      var ta = document.createElement("textarea"); ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch(e) {}
      document.body.removeChild(ta);
    }
  };

  // ── Nickname Modal ─────────────────────────────────────────────────
  ns.UI.Nickname = {
    _activeOverlay: null,
    _activeOnDone:  null,
    _activeOldName: "",

    show: function(title, subtitle, onDone) {
      var old = document.getElementById("nicknameModal"); if (old) old.remove();
      var overlay = document.createElement("div");
      overlay.id = "nicknameModal"; overlay.className = "modal-overlay";
      overlay.style.cssText = "display:flex;z-index:1000;";
      overlay.innerHTML =
        '<div class="modal-box" style="max-width:400px;">' +
        '  <h3 style="color:var(--gold);margin-bottom:4px;">'+U.escapeHtml(title||"🏀 设置昵称")+'</h3>'+
        '  <p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:14px;">'+U.escapeHtml(subtitle||"")+'</p>'+
        '  <input id="nicknameInput" type="text" maxlength="20" placeholder="匿名球迷"'+
        '    style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--card-border);'+
        '    background:rgba(255,255,255,0.06);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;"'+
        '    onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--card-border)\'"'+
        '    onkeydown="if(event.key===\'Enter\')BB82.UI.Nickname._confirm()">'+
        '  <div style="display:flex;gap:10px;margin-top:14px;justify-content:center;">'+
        '    <button class="btn btn-gold btn-sm" style="min-width:100px;" onclick="BB82.UI.Nickname._confirm()">✅ 确认</button>'+
        '    <button class="btn btn-secondary btn-sm" style="min-width:80px;" onclick="BB82.UI.Nickname._cancel()">取消</button>'+
        '  </div></div>';

      document.body.appendChild(overlay);

      this._activeOverlay = overlay;
      this._activeOnDone  = onDone || null;
      this._activeOldName = S.nickname;

      var input = document.getElementById("nicknameInput");
      if (input) {
        if (S.nickname) input.value = S.nickname;
        setTimeout(function(){ input.focus(); input.select(); }, 100);
      }

      overlay.addEventListener("click", function(e){ if (e.target===overlay) BB82.UI.Nickname._cancel(); });
    },

    _confirm: function() {
      var overlay = ns.UI.Nickname._activeOverlay;
      var input   = document.getElementById("nicknameInput");
      var name    = (input ? input.value.trim() : "") || "匿名球迷";
      if (!overlay) return;

      overlay.remove();
      ns.UI.Nickname._activeOverlay = null;
      var oldName = ns.UI.Nickname._activeOldName;
      S.nickname = name;

      // 同步历史记录（基于 auth.uid()，比指纹更稳定）
      if (oldName !== name) {
        console.log("[82-0] Syncing nickname:", oldName || "(new)", "→", name);
        A.updateNicknameByUser(name).then(function(res) {
          if (res && res.error)
            console.warn("[82-0] Nickname sync failed:", res.error.message);
          else
            console.log("[82-0] Nickname synced OK");
        });
      }

      if (ns.UI.Nickname._activeOnDone) ns.UI.Nickname._activeOnDone(name);
    },

    _cancel: function() {
      var overlay = ns.UI.Nickname._activeOverlay;
      if (overlay) overlay.remove();
      ns.UI.Nickname._activeOverlay = null;
      // 如果调用方传了回调，说明是首次设置昵称（来自 submit），取消也提交默认名
      if (ns.UI.Nickname._activeOnDone) {
        var cb = ns.UI.Nickname._activeOnDone;
        ns.UI.Nickname._activeOnDone = null;
        cb(S.nickname || "匿名球迷");
      }
    }
  };

  // ── Account Modal（绑定邮箱 / 登录）──────────────────────────────
  ns.UI.Account = {
    open: function() {
      var old = document.getElementById("accountModal"); if (old) old.remove();
      var isAnon = ns.Auth ? ns.Auth.isAnonymous : true;

      var overlay = document.createElement("div");
      overlay.id = "accountModal"; overlay.className = "modal-overlay";
      overlay.style.cssText = "display:flex;z-index:1000;";
      overlay.innerHTML =
        '<div class="modal-box" style="max-width:400px;">' +
        '  <h3 style="color:var(--gold);margin-bottom:4px;">' + (isAnon ? "🔐 绑定账号" : "🔑 登录账号") + '</h3>' +
        '  <p style="color:var(--text-muted);font-size:0.72rem;margin-bottom:14px;">' +
             (isAnon ? "绑定邮箱后，换设备也能找回你的数据" : "在其他设备登录，恢复你的数据") + '</p>' +
        '  <input id="accEmail" type="email" placeholder="邮箱地址" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--card-border);background:rgba(255,255,255,0.06);color:#fff;font-size:0.85rem;outline:none;box-sizing:border-box;margin-bottom:8px;" onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--card-border)\'">' +
        '  <input id="accPass" type="password" placeholder="密码（至少6位）" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--card-border);background:rgba(255,255,255,0.06);color:#fff;font-size:0.85rem;outline:none;box-sizing:border-box;margin-bottom:4px;" onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--card-border)\'">' +
        '  <div id="accMsg" style="font-size:0.68rem;color:var(--danger);min-height:18px;margin-bottom:8px;"></div>' +
        '  <div style="display:flex;gap:10px;justify-content:center;">' +
             (isAnon
               ? '<button class="btn btn-gold btn-sm" style="min-width:100px;" onclick="BB82.UI.Account._bind()">📧 绑定</button>'
               : '<button class="btn btn-gold btn-sm" style="min-width:100px;" onclick="BB82.UI.Account._login()">🔑 登录</button>') +
        '    <button class="btn btn-secondary btn-sm" style="min-width:80px;" onclick="BB82.UI.Account._close()">取消</button>' +
        '  </div></div>';

      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) BB82.UI.Account._close(); });

      // 回车提交
      var passEl = document.getElementById("accPass");
      if (passEl) passEl.addEventListener("keydown", function(e) {
        if (e.key === "Enter") isAnon ? BB82.UI.Account._bind() : BB82.UI.Account._login();
      });
      setTimeout(function() {
        var em = document.getElementById("accEmail"); if (em) em.focus();
      }, 100);
    },

    _close: function() { var o = document.getElementById("accountModal"); if (o) o.remove(); },

    _msg: function(text, isGood) {
      var el = document.getElementById("accMsg");
      if (el) { el.textContent = text || ""; el.style.color = isGood ? "var(--success)" : "var(--danger)"; }
    },

    _bind: function() {
      var email = (document.getElementById("accEmail")||{}).value || "";
      var pass  = (document.getElementById("accPass")||{}).value  || "";
      if (!email || pass.length < 6) { this._msg("请输入有效邮箱和至少6位密码"); return; }
      this._msg("绑定中...", true);

      var self = this;
      ns.Auth.bindAccount(email, pass).then(function(r) {
        if (r.ok) {
          self._msg("✅ 绑定成功！可在其他设备用邮箱登录", true);
          setTimeout(function(){ self._close(); }, 1500);
        } else {
          self._msg("❌ " + (r.error || "绑定失败"));
        }
      });
    },

    _login: function() {
      var email = (document.getElementById("accEmail")||{}).value || "";
      var pass  = (document.getElementById("accPass")||{}).value  || "";
      if (!email || !pass) { this._msg("请输入邮箱和密码"); return; }
      this._msg("登录中...", true);

      var self = this;
      ns.Auth.signIn(email, pass).then(function(r) {
        if (r.ok) {
          self._msg("✅ 登录成功！数据已同步", true);
          setTimeout(function(){ self._close(); }, 1500);
        } else {
          self._msg("❌ " + (r.error || "登录失败"));
        }
      });
    }
  };

  // ── Profile Modal（个人中心 — 昵称 + 账号 + 快捷入口）────────────
  ns.UI.Profile = {
    open: function() {
      var old = document.getElementById("profileModal"); if (old) old.remove();
      var isAnon = ns.Auth ? ns.Auth.isAnonymous : true;
      var nickname = S.nickname || "匿名球迷";
      var uid = ns.Auth ? ns.Auth.userId : "";

      var overlay = document.createElement("div");
      overlay.id = "profileModal"; overlay.className = "modal-overlay";
      overlay.style.cssText = "display:flex;z-index:950;";
      overlay.innerHTML =
        '<div class="modal-box" style="max-width:380px;">' +
        // 头像区
        '  <div style="text-align:center;margin-bottom:16px;">' +
        '    <div style="width:52px;height:52px;border-radius:50%;margin:0 auto 6px;background:linear-gradient(135deg,var(--gold),#e67e22);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">👤</div>' +
        '    <div style="font-size:0.9rem;font-weight:700;color:#fff;" id="profDisplayName">' + U.escapeHtml(nickname) + '</div>' +
        '    <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px;">' + (isAnon ? "匿名用户" : "已绑定账号") + '</div>' +
        '  </div>' +
        // 昵称行
        '  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
        '    <span style="font-size:0.78rem;color:var(--text-muted);">✏️ 昵称</span>' +
        '    <span style="font-size:0.8rem;color:#fff;">' + U.escapeHtml(nickname) + '</span>' +
        '    <button class="btn btn-secondary btn-sm" onclick="BB82.changeNickname(function(){BB82.UI.Profile._refresh();})" style="font-size:0.65rem;padding:3px 10px;">修改</button>' +
        '  </div>' +
        // 账号行
        '  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
        '    <span style="font-size:0.78rem;color:var(--text-muted);">' + (isAnon ? "🔐 绑定账号" : "🔑 账号") + '</span>' +
        '    <span style="font-size:0.72rem;color:var(--text-muted);">' + (isAnon ? "未绑定" : "已绑定") + '</span>' +
        '    <button class="btn btn-secondary btn-sm" onclick="BB82.UI.Account.open()" style="font-size:0.65rem;padding:3px 10px;">' + (isAnon ? "绑定" : "管理") + '</button>' +
        '  </div>' +
        // 快捷入口
        '  <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">' +
        '    <button class="btn btn-gold btn-sm" onclick="BB82.UI.Profile.close();BB82.UI.MyRecords.open();" style="flex:1;font-size:0.7rem;">📋 我的记录</button>' +
        '    <button class="btn btn-secondary btn-sm" onclick="BB82.UI.Profile.close()" style="flex:1;font-size:0.7rem;">关闭</button>' +
        '  </div></div>';

      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) BB82.UI.Profile.close(); });
    },

    close: function() { var o = document.getElementById("profileModal"); if (o) o.remove(); },

    _refresh: function() {
      // 昵称修改后的回调：刷新显示
      var el = document.getElementById("profDisplayName");
      if (el) el.textContent = S.nickname || "匿名球迷";
    }
  };

  // ── My Records Modal（我的战绩）─────────────────
  ns.UI.MyRecords = {
    open: function() {
      var old = document.getElementById("myRecordsModal"); if (old) old.remove();
      var overlay = document.createElement("div");
      overlay.id = "myRecordsModal"; overlay.className = "modal-overlay lb-overlay";
      overlay.style.cssText = "display:flex;z-index:900;";
      overlay.innerHTML =
        '<div class="lb-modal">' +
        '  <div class="lb-header"><h2 class="lb-title">📋 我的战绩</h2><button class="lb-close-btn" onclick="BB82.UI.MyRecords.close()">✕</button></div>' +
        '  <div class="lb-body" id="mrBody"><div class="lb-loading"><div class="lb-spinner"></div><p>加载中...</p></div></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function(e){ if (e.target===overlay) BB82.UI.MyRecords.close(); });
      this._load();
    },
    close: function() { var m = document.getElementById("myRecordsModal"); if (m) m.remove(); },
    _load: function() {
      var body = document.getElementById("mrBody"); if (!body) return;
      A.fetchMyRecords().then(function(res) {
        if (!document.getElementById("mrBody")) return;
        if (res.error) { body.innerHTML = '<div class="lb-empty">😵 加载失败</div>'; return; }
        var d = res.data||[];
        if (!d.length) {
          body.innerHTML = '<div class="lb-empty">📭 还没有上传过记录</div>';
          return;
        }
        body.innerHTML = '<div class="seg-header">📋 共 <strong>' + d.length + '</strong> 条记录</div>' + BB82.UI.Leaderboard._renderList(d, false);
      });
    }
  };

  // ── Leaderboard Modal ──────────────────────────────────────────────
  ns.UI.Leaderboard = {
    _period: "history",
    open: function() {
      var old = document.getElementById("leaderboardModal"); if (old) old.remove();
      this._period = "history";
      var overlay = document.createElement("div");
      overlay.id = "leaderboardModal"; overlay.className = "modal-overlay lb-overlay";
      overlay.style.cssText = "display:flex;z-index:900;";
      overlay.innerHTML = this._tpl();
      document.body.appendChild(overlay);
      var self = this;
      overlay.addEventListener("click", function(e){ if (e.target===overlay) self.close(); });
      this._loadSegments();
    },

    close: function() { var m = document.getElementById("leaderboardModal"); if (m) m.remove(); },

    _tpl: function() {
      return [
        '<div class="lb-modal">',
        '  <div class="lb-header">',
        '    <h2 class="lb-title">🏆 排行榜</h2>',
        '    <button class="lb-close-btn" onclick="BB82.UI.Leaderboard.close()">✕</button>',
        '  </div>',
        '  <div class="lb-tabs" id="lbTabs">',
        '    <button class="lb-tab active" data-period="history" onclick="BB82.UI.Leaderboard.switchTab(\'history\')"><span class="lb-tab-icon">📜</span>历史</button>',
        '    <button class="lb-tab"        data-period="week"    onclick="BB82.UI.Leaderboard.switchTab(\'week\')"><span class="lb-tab-icon">📅</span>本周</button>',
        '    <button class="lb-tab"        data-period="today"   onclick="BB82.UI.Leaderboard.switchTab(\'today\')"><span class="lb-tab-icon">☀️</span>今日</button>',
        '  </div>',
        '  <div class="lb-body" id="lbBody"><div class="lb-loading"><div class="lb-spinner"></div><p>加载数据中...</p></div></div>',
        '  </div>'
      ].join("");
    },

    switchTab: function(p) {
      this._period = p;
      document.querySelectorAll("#lbTabs .lb-tab").forEach(function(el){
        el.classList.toggle("active", el.dataset.period===p);
      });
      p === "history" ? this._loadSegments() : this._loadTop20();
    },

    _body: function() { return document.getElementById("lbBody"); },
    _modal: function() { return document.getElementById("leaderboardModal"); },

    // ══════════════════════════════════════════════════════════════
    //  历史总榜 — 分段统计
    // ══════════════════════════════════════════════════════════════
    _loadSegments: function() {
      var body = this._body(), self = this; if (!body) return;
      body.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div><p>统计中...</p></div>';

      A.fetchAllWins("all").then(function(res) {
        if (!self._body()||!self._modal()) return;
        if (res.error) { body.innerHTML = '<div class="lb-empty">😵 加载失败</div>'; return; }

        // 提取 wins 数组 — Supabase 返回 [{wins:82}, {wins:76}, ...]
        var rows = res.data || [];
        var wins = [];
        for (var i = 0; i < rows.length; i++) {
          var w = rows[i].wins;
          if (typeof w === "number" && w >= 0 && w <= 82) wins.push(w);
        }
        if (!wins.length) { body.innerHTML = '<div class="lb-empty">🏀 暂无记录，快来创造历史吧！</div>'; return; }

        body.innerHTML = self._renderSegments(wins);
      });
    },

    _renderSegments: function(allWins) {
      var total = allWins.length;
      var segs  = C.SEGMENTS;
      var h = '<div class="seg-list">';

      // 1) 先算各段人数，收集有数据的段
      var filled = [];
      segs.forEach(function(s) {
        var count = 0;
        for (var i = 0; i < allWins.length; i++) { if (allWins[i] >= s.min && allWins[i] <= s.max) count++; }
        if (count > 0) filled.push({ s: s, count: count });
      });

      // 2) 动态分配 medal 图标（👑🥇🥈🥉 → 📊）
      var medalIcons = ["👑","🥈","🥉"];
      for (var m = 0; m < filled.length && m < medalIcons.length; m++) {
        filled[m].icon = medalIcons[m];
      }
      for (var n = medalIcons.length; n < filled.length; n++) {
        filled[n].icon = "📊";
      }

      // 3) 渲染
      filled.forEach(function(f) {
        var pct = Math.max(Math.round(f.count / total * 100), 1);
        h +=
          '<div class="seg-row ' + f.s.cls + '">' +
          '  <span class="seg-icon">' + f.icon + '</span>' +
          '  <span class="seg-label">' + f.s.label + '</span>' +
          '  <span class="seg-bar-wrap"><span class="seg-bar" style="width:' + pct + '%"></span></span>' +
          '  <span class="seg-count">' + f.count + '</span>' +
          '</div>';
      });

      return h + '</div><div class="seg-header">🏀 共 <strong>' + total + '</strong> 次参与</div>';
    },

    // ══════════════════════════════════════════════════════════════
    //  本周 / 今日 — Top 20 个人榜
    // ══════════════════════════════════════════════════════════════
    _loadTop20: function() {
      var body = this._body(), self = this; if (!body) return;
      body.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div><p>加载中...</p></div>';

      A.fetchLeaderboard(this._period, 20).then(function(res) {
        if (!self._body()||!self._modal()) return;
        if (res.error) { body.innerHTML = '<div class="lb-empty">😵 加载失败</div>'; return; }
        var d = res.data||[];
        if (!d.length) {
          var m = self._period==="today"?"今日":"本周";
          body.innerHTML = '<div class="lb-empty">🏀 '+m+'暂无记录，快来创造历史！</div>';
          return;
        }
        body.innerHTML = self._renderList(d, true, false);
      });
    },

    // ══════════════════════════════════════════════════════════════
    //  我的记录（弹窗）
    // ══════════════════════════════════════════════════════════════
    _loadMyRecords: function() {
      var body = this._body(), self = this; if (!body) return;
      body.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div><p>加载中...</p></div>';

      A.fetchMyRecords().then(function(res) {
        if (!self._body()||!self._modal()) return;
        if (res.error) { body.innerHTML = '<div class="lb-empty">😵 加载失败</div>'; return; }
        var d = res.data||[];
        if (!d.length) {
          body.innerHTML =
            '<div class="lb-empty">📭 你还没有上传过记录</div>' +
            '<div style="text-align:center;margin-top:6px;font-size:0.7rem;color:var(--text-muted);">昵称：' + U.escapeHtml(S.nickname||"未设置") + '</div>';
          return;
        }
        body.innerHTML =
          '<div class="seg-header">📋 我的记录 · <strong>' + d.length + '</strong> 条</div>' +
          self._renderList(d, false, true);
      });
    },

    // ══════════════════════════════════════════════════════════════
    //  列表渲染（复用）
    // ══════════════════════════════════════════════════════════════
    _renderList: function(records, showRank, showShare) {
      var h = '';
      // ── 领奖台 ────────────────────────────────────────────
      if (showRank && records.length > 0) {
        var podium = [null,null,null]; // [#2左, #1中, #3右]
        var r = 0, pw = -1;
        for (var i = 0; i < records.length && r < 3; i++) {
          if (records[i].wins !== pw) { r++; pw = records[i].wins; var slot = r===1?1:r===2?0:2; podium[slot] = records[i]; podium[slot]._podium = true; }
        }
        h += '<div class="lb-podium">';
        var hts = ['90px','120px','80px'], lbs = ['🥈','🥇','🥉'];
        var pbs = ['12px','25px','5px']; // 底部垫高
        for (var pi = 0; pi < 3; pi++) {
          var p = podium[pi];
          if (!p) { h += '<div class="lb-podium-spot" style="height:'+hts[pi]+';padding-bottom:'+pbs[pi]+';"></div>'; continue; }
          var jd = JSON.stringify({ username: p.username, wins: p.wins, record: p.record, player_names: p.player_names, decades: p.decades, teams: p.teams, created_at: p.created_at });
          h += '<div class="lb-podium-spot" style="height:'+hts[pi]+';padding-bottom:'+pbs[pi]+';cursor:pointer;" onclick="BB82.Share.view(JSON.parse(this.dataset.r))" data-r=\'' + jd + '\'>' +
            '<div class="lb-podium-medal">'+lbs[pi]+'</div>' +
            '<div class="lb-podium-name">'+U.escapeHtml(p.username||"匿名球迷")+'</div>' +
            '<div class="lb-podium-wins">'+p.wins+' 胜</div>' +
          '</div>';
        }
        h += '</div>';
      }

      // ── 列表 ──────────────────────────────────────────────
      h += '<div class="lb-list">';
      var rank = 0, prevWins = -1;
      for (var j = 0; j < records.length; j++) {
        var rec = records[j];
        if (rec.wins !== prevWins) { rank++; prevWins = rec.wins; }
        if (showRank && rank <= 3 && rec._podium) continue;
        h += this._rowHtml(rec, showRank ? rank : 0, showShare);
      }
      h += '</div>';
      return h;
    },

    _rowHtml: function(r, rank, showShare) {
      var rankH = rank > 0 ? '<span class="lb-rank lb-rank-num">' + rank + '</span>' : '';
      var ts    = r.created_at ? U.timeAgo(r.created_at) : "";
      var shareH = showShare
        ? '<button class="lb-share-btn" onclick="event.stopPropagation();BB82.Share.record(\'' + (r.share_code||"") + '\',\'' + U.escapeHtml(r.username||"匿名球迷").replace(/'/g,"\\'") + '\',' + r.wins + ')" title="分享">📤</button>'
        : '';
      var jd = JSON.stringify({ username: r.username, wins: r.wins, record: r.record, player_names: r.player_names, decades: r.decades, teams: r.teams, created_at: r.created_at }).replace(/'/g, "&#39;");
      return '<div class="lb-row" style="cursor:pointer;" onclick="BB82.Share.view(JSON.parse(this.dataset.r))" data-r=\'' + jd + '\'>' +
        '  <div class="lb-row-left">' + rankH +
        '    <div class="lb-row-info"><div class="lb-username">' + U.escapeHtml(r.username||"匿名球迷") + '</div>' +
        '      <div class="lb-time">' + U.escapeHtml(ts) + '</div></div>' +
        '  </div>' +
        '  <div class="lb-row-right">' +
        '    <span class="lb-wins">' + r.wins + ' 胜</span>' +
        shareH +
        '  </div>' +
        '</div>';
    }
  };

  // ── UploadedHint ───────────────────────────────────────────────────
  ns.UI.UploadedHint = {
    _timer: null,
    show: function(success, msg) {
      var el = document.getElementById("uploadedHint"); if (!el) return;
      if (this._timer) clearTimeout(this._timer);
      if (success) { el.textContent="✅ 已上传至排行榜"; el.className="uploaded-hint uploaded-hint-success"; }
      else         { el.textContent="⚠️ "+(msg||"上传失败"); el.className="uploaded-hint uploaded-hint-error"; }
      el.style.display=""; el.style.opacity="1";
      if (!success) { var self=this; this._timer=setTimeout(function(){ el.style.opacity="0"; el.style.transition="opacity 0.5s"; self._timer=setTimeout(function(){ el.style.display="none"; },500); },5000); }
    }
  };

})(BB82);

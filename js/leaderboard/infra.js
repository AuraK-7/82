// ===================================================================
//  leaderboard/infra.js — 基础设施层：配置 / 存储 / Supabase / 指纹
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  // ── CONFIG ────────────────────────────────────────────────────────
  ns.CONFIG = {
    SUPABASE_URL:     "https://pqbpahaivxtanxkzyuiq.supabase.co",
    SUPABASE_KEY:     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnBhaGFpdnh0YW54a3p5dWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY4NTksImV4cCI6MjA5NzE2Mjg1OX0.peV6JnZMyH4BCsie-F110wLlTMFZKrfrbd6y9i6NF0I",
    TABLE:            "82_records",
    COOLDOWN_FP_MS:   30000,
    COOLDOWN_NAME_MS: 120000,
    COOLDOWN_ROSTER_MS:300000,
    LB_LIMIT:         20,
    STORAGE_PREFIX:   "bb82_",

    MAX_USERNAME_LEN:   20,
    MAX_PLAYERNAME_LEN: 80,
    MAX_DECADE_LEN:     10,
    MAX_TEAM_LEN:       5,
    MAX_RECORD_LEN:     10,

    FP_COOKIE:          "bb82_fp",   // 指纹备份 Cookie 名

    // 胜场分段（历史 Tab）
    SEGMENTS: [
      { label: "82 胜",    min: 82, max: 82, icon: "👑", cls: "seg-perfect" },
      { label: "80-81 胜", min: 80, max: 81, icon: "🥇", cls: "seg-elite"  },
      { label: "70-79 胜", min: 70, max: 79, icon: "🥈", cls: "seg-great"  },
      { label: "60-69 胜", min: 60, max: 69, icon: "🥉", cls: "seg-good"   },
      { label: "50-59 胜", min: 50, max: 59, icon: "📊", cls: "seg-avg"    },
      { label: "40-49 胜", min: 40, max: 49, icon: "📊", cls: "seg-avg"    },
      { label: "30-39 胜", min: 30, max: 39, icon: "📊", cls: "seg-avg"    },
      { label: "20-29 胜", min: 20, max: 29, icon: "📊", cls: "seg-low"    },
      { label: "10-19 胜", min: 10, max: 19, icon: "📊", cls: "seg-low"    },
      { label: "1-9 胜",   min: 1,  max: 9,  icon: "📊", cls: "seg-low"    },
      { label: "0 胜",     min: 0,  max: 0,  icon: "💀", cls: "seg-zero"   }
    ]
  };

  // ── Storage ───────────────────────────────────────────────────────
  ns.Storage = {
    _k: function(name) { return ns.CONFIG.STORAGE_PREFIX + name; },

    get: function(name, fallback) {
      var v = localStorage.getItem(this._k(name));
      return v !== null ? v : (fallback !== undefined ? fallback : null);
    },
    set: function(name, value)   { localStorage.setItem(this._k(name), String(value)); },
    remove: function(name)       { localStorage.removeItem(this._k(name)); },

    get nickname()    { return this.get("nickname", ""); },
    set nickname(v)   { this.set("nickname", v); },
    get lastSubmitTs(){ var v = this.get("last_submit"); return v ? parseInt(v, 10) : 0; },
    set lastSubmitTs(v){ this.set("last_submit", v); },
    get lastSubmitFp(){ return this.get("last_fp", ""); },
    set lastSubmitFp(v){ this.set("last_fp", v); }
  };

  // ── Cookie 工具 ───────────────────────────────────────────────────
  var Cookie = {
    set: function(name, value, days) {
      days = days || 365;
      var d = new Date(); d.setTime(d.getTime() + days * 86400000);
      document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    },
    get: function(name) {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, "\\$1") + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : "";
    }
  };

  // ── Supabase ──────────────────────────────────────────────────────
  var _sb = null;
  ns.Supabase = {
    get: function() {
      if (_sb) return _sb;
      if (typeof supabase !== "undefined" && supabase.createClient) {
        _sb = supabase.createClient(ns.CONFIG.SUPABASE_URL, ns.CONFIG.SUPABASE_KEY);
        return _sb;
      }
      // CDN 未加载时返回安全 mock
      console.warn("[82-0] Supabase CDN not loaded, using mock");
      return ns.Supabase._mock();
    },

    /** 安全 mock：CDN 加载失败时所有查询返回空数据 */
    _mock: function() {
      var chain = function() { return chain; };
      chain.then = function(fn) { return Promise.resolve({ data: [], error: null }).then(fn); };
      chain.single = function() { return chain; };
      chain.from = function() { return chain; };
      chain.select = function() { return chain; };
      chain.insert = function() { return chain; };
      chain.update = function() { return chain; };
      chain.eq = function() { return chain; };
      chain.gte = function() { return chain; };
      chain.lte = function() { return chain; };
      chain.order = function() { return chain; };
      chain.limit = function() { return chain; };
      chain.is = function() { return chain; };
      chain.contains = function() { return chain; };
      chain.neq = function() { return chain; };
      chain.match = function() { return chain; };
      return chain;
    }
  };

  // ══════════════════════════════════════════════════════════════════
  //  FINGERPRINT — 三层递进，防绕过
  //
  //  Layer 1  fingerprintjs   浏览器特征 (Canvas/WebGL/Font…)
  //           → 最可靠，清 localStorage/Cookie 都不变
  //  Layer 2  Cookie          独立于 localStorage 的持久备份
  //           → 清 localStorage 后仍然存在
  //  Layer 3  navigator 复合  基于真实浏览器属性，非随机
  //           → 即使 fingerprintjs 加载失败也能用
  //
  //  同步策略：Layer1 成功时写回 Cookie，保证 Layer2 始终最新
  // ══════════════════════════════════════════════════════════════════
  var _fpPromise = null, _fpCached = null;

  ns.Fingerprint = {
    get: function() {
      if (_fpCached)  return Promise.resolve(_fpCached);
      if (_fpPromise) return _fpPromise;

      var self = this;

      if (typeof FingerprintJS !== "undefined") {
        // ── Layer 1: fingerprintjs（主力） ────────────────────────────
        _fpPromise = FingerprintJS.load()
          .then(function(fp) { return fp.get(); })
          .then(function(r) {
            _fpCached = r.visitorId;
            // 同步到 Cookie，供 Layer2 兜底
            Cookie.set(ns.CONFIG.FP_COOKIE, _fpCached);
            return _fpCached;
          })
          .catch(function() {
            // fingerprintjs 加载失败 → 退回 Layer2
            _fpCached = self._layer2();
            return _fpCached;
          });
      } else {
        // fingerprintjs CDN 未加载 → 直接 Layer2
        _fpCached = self._layer2();
        _fpPromise = Promise.resolve(_fpCached);
      }
      return _fpPromise;
    },

    /** Layer2: Cookie 备份（独立于 localStorage，清缓存可存活） */
    _layer2: function() {
      var fp = Cookie.get(ns.CONFIG.FP_COOKIE);
      if (fp) return fp;
      // Cookie 也没有 → Layer3
      fp = this._layer3();
      Cookie.set(ns.CONFIG.FP_COOKIE, fp);
      return fp;
    },

    /** Layer3: navigator 特征复合值（基于真实浏览器属性，非随机） */
    _layer3: function() {
      var n  = window.navigator;
      var s  = window.screen;
      var tz = Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
      var raw = [
        n.hardwareConcurrency || "",
        n.deviceMemory        || "",
        n.language            || n.languages ? n.languages.join(",") : "",
        n.platform            || "",
        n.vendor              || "",
        s.width, s.height, s.colorDepth,
        tz,
        !!window.chrome, !!window.opera
      ].join("|");
      // 简单 hash：djb2
      var hash = 5381;
      for (var i = 0; i < raw.length; i++) { hash = ((hash << 5) + hash) + raw.charCodeAt(i); hash |= 0; }
      return "nav_" + (hash >>> 0).toString(36);
    }
  };

  // ── Dev Mode（暗号令牌 hash 校验）───────────
  ns.DEV = {
    active: function() {
      var token = ns.Storage.get("_sim");
      if (!token) return false;
      // djb2 → 比对预计算 hash
      var h = 5381;
      for (var i = 0; i < token.length; i++) { h = ((h << 5) + h) + token.charCodeAt(i); h |= 0; }
      return (h >>> 0).toString(36) === "1xng3bx";
    }
  };

})(BB82);

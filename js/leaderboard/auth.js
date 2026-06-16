// ===================================================================
//  leaderboard/auth.js — Supabase Auth（匿名登录 + 账号绑定）
//
//  流程：
//  1. init() → 恢复 session / 匿名登录 → 持久 UUID
//  2. bindAccount(email, pw) → 匿名升级为邮箱账号（UUID 不变）
//  3. signIn(email, pw) → 其他设备登录，恢复同一 UUID
// ===================================================================
var BB82 = BB82 || {};

(function(ns) {
  "use strict";

  var _ready = false;
  var _userId = null;
  var _isAnonymous = true;

  ns.Auth = {

    get ready()       { return _ready; },
    get userId()      { return _userId; },
    get isAnonymous() { return _isAnonymous; },

    // ── 初始化 ──────────────────────────────────────────────────────
    init: function() {
      var sb = ns.Supabase.get();
      if (!sb) return Promise.reject(new Error("Supabase not ready"));

      var self = this;

      return sb.auth.getSession().then(function(res) {
        if (res.data && res.data.session) {
          var u = res.data.session.user;
          _userId      = u.id;
          _isAnonymous = u.is_anonymous !== false;
          _ready       = true;
          console.log("[82-0] Auth restored:", _userId.slice(0, 8) + "...", _isAnonymous ? "(匿名)" : "(已绑定)");
          return _userId;
        }

        // 无 session → 匿名登录
        return sb.auth.signInAnonymously().then(function(r2) {
          if (r2.error) throw r2.error;
          _userId      = r2.data.user.id;
          _isAnonymous = true;
          _ready       = true;
          console.log("[82-0] Auth anonymous:", _userId.slice(0, 8) + "...");
          return _userId;
        });
      }).catch(function(err) {
        console.warn("[82-0] Auth failed, fallback fingerprint:", err.message);
        _isAnonymous = true;
        _ready = true;
        // 指纹兜底 — _userId 为 null 表示未认证，不写入 user_id 列
        _userId = null;
        return null;
      });
    },

    wait: function() {
      if (_ready) return Promise.resolve(_userId);
      return new Promise(function(resolve) {
        var start = Date.now();
        var t = setInterval(function() {
          if (_ready) { clearInterval(t); resolve(_userId); return; }
          if (Date.now() - start > 10000) {
            clearInterval(t);
            _ready = true; _userId = null; resolve(null);
          }
        }, 200);
      });
    },

    // ── 账号绑定（匿名 → 邮箱）─────────────────────────────────────
    /**
     * 将当前匿名账号升级为邮箱密码账号。UUID 不变，数据不丢。
     * @returns Promise<{ok, error?}>
     */
    bindAccount: function(email, password) {
      var sb = ns.Supabase.get();
      if (!sb) return Promise.resolve({ ok: false, error: "网络不可用" });
      if (!_ready || _isAnonymous === false) return Promise.resolve({ ok: false, error: "当前已是正式账号" });

      return sb.auth.updateUser({ email: email, password: password }).then(function(res) {
        if (res.error) return { ok: false, error: res.error.message };
        _isAnonymous = false;
        console.log("[82-0] Account bound:", email);
        return { ok: true };
      });
    },

    // ── 邮箱登录（其他设备恢复）────────────────────────────────────
    /**
     * 用邮箱密码登录，替换当前匿名 session。
     * 自动将当前匿名记录迁移到登录账号。
     * @returns Promise<{ok, error?}>
     */
    signIn: function(email, password) {
      var sb = ns.Supabase.get();
      if (!sb) return Promise.resolve({ ok: false, error: "网络不可用" });

      var oldUid = _userId; // 保存旧 UUID 用于迁移

      return sb.auth.signInWithPassword({ email: email, password: password }).then(function(res) {
        if (res.error) return { ok: false, error: res.error.message };
        var newUid = res.data.user.id;
        _userId      = newUid;
        _isAnonymous = false;
        _ready       = true;
        console.log("[82-0] Signed in:", email, newUid.slice(0, 8) + "...");

        // 迁移旧匿名记录到新 UUID
        if (oldUid && oldUid !== newUid) {
          ns.API._t().update({ user_id: newUid }).eq("user_id", oldUid).then(function(r) {
            if (!r.error) console.log("[82-0] Migrated anonymous records to new account");
          });
        }
        return { ok: true };
      });
    }
  };

})(BB82);

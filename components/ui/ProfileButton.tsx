"use client";

// ===================================================================
//  components/ui/ProfileButton.tsx — 个人中心（昵称 + 战绩）
// ===================================================================
import { useState, useRef, useEffect } from "react";
import { useGameContext } from "@/components/game/GameProviders";

interface GameRecord {
  id: string;
  game_mode: string;
  score: number;
  result: string;
  created_at: string;
  roster: { player_names: string[] };
}

interface ProfileStats {
  total_games: number;
  total_wins: number;
  best_score: number | null;
}

export function ProfileButton() {
  const { nickname, setNickname, nicknameMaxLength, isLoggedIn, getUserIdAsync, currentScreen, userId } = useGameContext();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"info" | "records">("info");
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 战绩数据
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [stats, setStats] = useState<ProfileStats>({ total_games: 0, total_wins: 0, best_score: null });

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 开始编辑时自动聚焦
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // 打开时加载数据
  useEffect(() => {
    if (!open || !userId) return;
    // 加载 stats
    fetch(`/api/profiles?user_id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setStats({
            total_games: json.data.total_games || 0,
            total_wins: json.data.total_wins || 0,
            best_score: json.data.best_score ?? null,
          });
        }
      })
      .catch(() => {});
    // 加载个人记录
    setRecordsLoading(true);
    fetch(`/api/records?user_id=${encodeURIComponent(userId)}&limit=10`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setRecords(json.data);
      })
      .catch(() => {})
      .finally(() => setRecordsLoading(false));
  }, [open, userId]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setMsg("昵称不能为空"); return; }
    if (trimmed.length > nicknameMaxLength) { setMsg(`昵称最长${nicknameMaxLength}个字符`); return; }
    setSaving(true);
    await getUserIdAsync();
    const ok = await setNickname(trimmed);
    setSaving(false);
    if (ok) { setMsg(null); setEditing(false); }
    else { setMsg("保存失败，请重试"); }
  };

  const handleOpen = () => {
    setDraft(nickname);
    setMsg(null);
    setEditing(false);
    setOpen(!open);
    setTab("info");
  };

  const winRate = stats.total_games > 0
    ? Math.round((stats.total_wins / stats.total_games) * 100)
    : null;

  // 游戏界面隐藏（所有 hooks 之后才可条件返回）
  const gameScreens = new Set(["screen-game", "screen-custom", "screen-battle-play", "screen-playoffs", "screen-dream-select"]);
  if (gameScreens.has(currentScreen)) return null;

  return (
    <>
      {/* 触发按钮 */}
      <button
        className="profile-btn"
        onClick={handleOpen}
        title="个人中心"
        style={triggerBtnStyle}
      >
        👤
      </button>

      {/* 弹窗 */}
      {open && (
        <div ref={popupRef} style={popupStyle}>
          {/* 关闭按钮 */}
          <button onClick={() => setOpen(false)}
            style={{ position: "absolute", top: 8, right: 10, width: 24, height: 24,
              borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)",
              color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            ✕
          </button>
          {/* 头像 + 昵称 */}
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={avatarStyle}>{nickname.charAt(0)}</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", marginTop: 6 }}>{nickname}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.65rem", marginTop: 2 }}>{isLoggedIn ? "已登录" : "游客模式"}</div>
          </div>

          {/* 统计数据卡片 */}
          <div style={statsRowStyle}>
            <div style={statItemStyle}>
              <div style={statValueStyle}>{stats.total_games}</div>
              <div style={statLabelStyle}>场次</div>
            </div>
            <div style={statItemStyle}>
              <div style={{ ...statValueStyle, color: "var(--success)" }}>{stats.total_wins}</div>
              <div style={statLabelStyle}>胜场</div>
            </div>
            <div style={statItemStyle}>
              <div style={{ ...statValueStyle, color: "var(--gold)" }}>
                {stats.best_score != null ? `${stats.best_score}胜` : "-"}
              </div>
              <div style={statLabelStyle}>最佳</div>
            </div>
            <div style={statItemStyle}>
              <div style={{ ...statValueStyle, color: winRate != null ? "var(--accent-light)" : "var(--text-muted)" }}>
                {winRate != null ? `${winRate}%` : "-"}
              </div>
              <div style={statLabelStyle}>胜率</div>
            </div>
          </div>

          {/* Tab 切换 */}
          <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setTab("info")}
              style={{ ...tabBtnStyle, background: tab === "info" ? "rgba(255,255,255,0.1)" : "transparent", color: tab === "info" ? "#fff" : "var(--text-muted)" }}
            >个人</button>
            <button
              onClick={() => setTab("records")}
              style={{ ...tabBtnStyle, background: tab === "records" ? "rgba(255,255,255,0.1)" : "transparent", color: tab === "records" ? "#fff" : "var(--text-muted)" }}
            >战绩</button>
          </div>

          {/* 个人 Tab */}
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {editing ? (
                <>
                  <input
                    ref={inputRef}
                    type="text" value={draft} maxLength={nicknameMaxLength}
                    onChange={(e) => { setDraft(e.target.value); setMsg(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
                    style={{ ...inputStyle, textAlign: "left" }}
                    placeholder="输入新昵称"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{draft.length}/{nicknameMaxLength}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditing(false); setMsg(null); setDraft(nickname); }} style={cancelBtnStyle}>取消</button>
                      <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>{saving ? "保存中..." : "💾 保存"}</button>
                    </div>
                  </div>
                  {msg && <div style={{ fontSize: "0.65rem", color: "var(--danger)", marginTop: 2 }}>{msg}</div>}
                </>
              ) : (
                <button onClick={() => { setEditing(true); setDraft(nickname); setMsg(null); }} style={actionBtnStyle}>✏️ 修改昵称</button>
              )}
            </div>
          )}

          {/* 战绩 Tab */}
          {tab === "records" && (
            <div>
              {recordsLoading ? (
                <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: "0.75rem" }}>加载中...</div>
              ) : records.length === 0 ? (
                <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  🏀 暂无游戏记录<br /><span style={{ fontSize: "0.6rem" }}>完成一局游戏后自动记录</span>
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {records.slice(0, 10).map((r) => (
                    <div key={r.id} style={recordRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.75rem", color: "#fff", fontWeight: 600 }}>
                          {modeLabel(r.game_mode)} · {r.result}
                        </div>
                        <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 1 }}>
                          {formatDate(r.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: r.score >= 62 ? "var(--success)" : "var(--text-muted)" }}>
                        {r.score}胜
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── 工具函数 ────────────────────────────────────────────────────────

function modeLabel(mode: string): string {
  const map: Record<string, string> = { classic: "经典", custom: "自选", dream: "圆梦", challenge: "挑战", "era-cross": "年代穿越", "same-team": "同队", "no-repeat": "国际" };
  return map[mode] || mode;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ── 样式常数 ────────────────────────────────────────────────────────

const triggerBtnStyle: React.CSSProperties = {
  position: "fixed", top: 12, right: 16, zIndex: 999,
  width: 36, height: 36, borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1.1rem", cursor: "pointer", lineHeight: 1,
};

const popupStyle: React.CSSProperties = {
  position: "fixed", top: 56, right: 16, zIndex: 1000, width: 280,
  background: "rgba(22,33,62,0.98)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14, padding: "18px 16px 14px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(10px)",
};

const avatarStyle: React.CSSProperties = {
  width: 46, height: 46, borderRadius: "50%",
  background: "linear-gradient(135deg,#f59e0b,#eab308)",
  display: "flex", alignItems: "center", justifyContent: "center",
  margin: "0 auto 6px", fontSize: "1.4rem", fontWeight: 700, color: "#1a1a2e",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "0.85rem", textAlign: "center", outline: "none",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 6, border: "none",
  background: "var(--gold)", color: "#1a1a2e", cursor: "pointer",
  fontSize: "0.7rem", fontWeight: 600,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.7rem",
};

const statsRowStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-around", marginBottom: 14,
  padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const statItemStyle: React.CSSProperties = { textAlign: "center", flex: 1 };
const statValueStyle: React.CSSProperties = { fontSize: "1rem", fontWeight: 700, color: "#fff" };
const statLabelStyle: React.CSSProperties = { fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 1 };

const tabBtnStyle: React.CSSProperties = {
  flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
  cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, textAlign: "center",
};

const actionBtnStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "none", background: "rgba(255,255,255,0.06)",
  color: "var(--text-light)", cursor: "pointer",
  fontSize: "0.8rem", textAlign: "left",
};

const recordRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 4, background: "rgba(255,255,255,0.02)", marginBottom: 2,
};

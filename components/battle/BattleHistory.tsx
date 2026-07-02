"use client";

// ===================================================================
//  components/battle/BattleHistory.tsx — 对战历史记录
// ===================================================================
import { useEffect, useState } from "react";

interface HistoryRecord {
  id: string; opponent_name: string | null; is_win: boolean;
  series_score: string; my_roster: { name: string; slot: string; rating: number }[] | null;
  opponent_roster: { name: string; slot: string; rating: number }[] | null;
  game_details: { hostScore: number; guestScore: number }[] | null;
  room_code: string | null; created_at: string;
}

export function BattleHistory({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // 优先从 API 加载，降级 local
    const load = async () => {
      try {
        const res = await fetch("/api/battle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getState", payload: {} }) });
        const json = await res.json();
        if (json.success && json.data?.length) { setRecords(json.data); return; }
      } catch { /* API unavailable, fallback to localStorage */ }
      try {
        const raw = localStorage.getItem("bb82_battle_history");
        setRecords(raw ? JSON.parse(raw) : []);
      } catch { setRecords([]); }
    };
    load().catch(() => setError("加载失败")).finally(() => setLoading(false));
  }, []);

  const timeStr = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="modal-overlay lb-overlay" style={{ display: "flex", zIndex: 900 }} onClick={onClose}>
      <div className="lb-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="lb-header">
          <h2 className="lb-title">⚔️ 对战历史</h2>
          <button className="lb-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="lb-body">
          {loading ? (
            <div className="lb-loading"><div className="lb-spinner" /><p>加载中...</p></div>
          ) : error ? (
            <div className="lb-empty">😵 {error}</div>
          ) : records.length === 0 ? (
            <div className="lb-empty">📭 还没有对战记录<br /><span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>创建或加入一个房间开始对战吧！</span></div>
          ) : (
            records.map((r) => (
              <div key={r.id} className="battle-history-entry"
                style={{ padding: "10px 12px", margin: "4px 0", background: "rgba(255,255,255,0.04)", borderRadius: 8, cursor: "pointer" }}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: r.is_win ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                    {r.is_win ? "✅" : "❌"} {r.series_score}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>VS {r.opponent_name || "对手"}</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{r.created_at ? timeStr(r.created_at) : ""}</span>
                </div>
                {expanded === r.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.68rem" }}>
                    {r.my_roster && (
                      <div style={{ marginBottom: 4 }}>我的: {r.my_roster.map((p) => `${p.name?.split("-").pop() || "?"} ⭐${p.rating || "?"}`).join(" · ")}</div>
                    )}
                    {r.game_details && r.game_details.length > 0 && (
                      <div>{r.game_details.map((g, i) => `G${i + 1}: ${g.hostScore}-${g.guestScore}`).join(" | ")}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

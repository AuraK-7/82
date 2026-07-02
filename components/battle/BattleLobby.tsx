"use client";

// ===================================================================
//  components/battle/BattleLobby.tsx — 对战大厅组件
//  支持「独立随机」与「公共池抢选」双模式
// ===================================================================
import { useState } from "react";
import type { PickMode } from "./CommonPickPanel";

interface Props {
  onCreateRoom: (pickMode: PickMode) => void;
  onJoinRoom: (roomCode: string) => void;
  onShowHistory: () => void;
  onBackToMenu: () => void;
  loading?: boolean;
  roomCodeCreated?: string | null;
}

export function BattleLobby({
  onCreateRoom,
  onJoinRoom,
  onShowHistory,
  onBackToMenu,
  loading = false,
  roomCodeCreated = null,
}: Props) {
  const [roomCode, setRoomCode] = useState("");
  const [pickMode, setPickMode] = useState<PickMode>("independent");

  const handleCreate = () => {
    onCreateRoom(pickMode);
  };

  const handleJoin = () => {
    if (roomCode.length === 6) {
      onJoinRoom(roomCode.toUpperCase());
    }
  };

  return (
    <div id="screen-battle-lobby" className="screen active">
      <div
        className="battle-lobby-content"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 20px",
          gap: 24,
          minHeight: "60vh",
          justifyContent: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "Oswald, sans-serif",
            color: "var(--gold-light)",
            fontSize: "1.8rem",
          }}
        >
          🏆 双人对战
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            textAlign: "center",
            maxWidth: "400px",
          }}
        >
          创建房间邀请好友，各自组建阵容后进行BO7系列赛对决！
        </p>

        {/* 模式选择 */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "var(--card-bg)",
            borderRadius: "12px",
            padding: "4px",
            border: "1px solid var(--card-border)",
          }}
        >
          <button
            onClick={() => setPickMode("independent")}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background:
                pickMode === "independent"
                  ? "rgba(243,156,18,0.2)"
                  : "transparent",
              color: pickMode === "independent" ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            🎰 独立随机
          </button>
          <button
            onClick={() => setPickMode("common")}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background:
                pickMode === "common"
                  ? "rgba(243,156,18,0.2)"
                  : "transparent",
              color: pickMode === "common" ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            🏀 公共池抢选
          </button>
        </div>

        {/* 模式说明 */}
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.7rem",
            textAlign: "center",
            maxWidth: "340px",
          }}
        >
          {pickMode === "independent"
            ? "双方各自老虎机抽选球员，独立组建阵容"
            : "双方轮流从同一球员池中选人，先选先得，策略对决"}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
            maxWidth: 340,
          }}
        >
          <button
            className="btn btn-gold"
            onClick={handleCreate}
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "⏳ 创建中..." : "🏠 创建房间"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              maxLength={6}
              placeholder="输入6位房间号"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "0.9rem",
                outline: "none",
                textTransform: "uppercase",
                letterSpacing: 2,
                textAlign: "center",
              }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={loading || roomCode.length !== 6}
              style={{ justifyContent: "center", whiteSpace: "nowrap" }}
            >
              🚪 加入
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={onShowHistory}
            style={{ width: "100%", justifyContent: "center" }}
          >
            📋 历史战绩
          </button>

          <button
            className="btn btn-secondary"
            onClick={onBackToMenu}
            style={{ width: "100%", justifyContent: "center" }}
          >
            🏠 返回主菜单
          </button>
        </div>

        {/* 房间创建成功提示 */}
        {roomCodeCreated && (
          <div
            id="battleLobbyWait"
            style={{ textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              房间号
            </div>
            <div
              id="battleRoomCodeDisplay"
              style={{
                marginBottom: 4,
                fontSize: "2rem",
                fontFamily: "Oswald, monospace",
                color: "var(--gold-light)",
                letterSpacing: "4px",
                fontWeight: 700,
              }}
            >
              {roomCodeCreated}
            </div>
            <button
              onClick={() => {
                const link = `${window.location.origin}/?screen=battle&room=${roomCodeCreated}`;
                navigator.clipboard.writeText(link).then(() => {
                  alert("已复制分享链接！\n发送给好友即可加入对战");
                }).catch(() => {
                  // 降级：复制房间号
                  navigator.clipboard.writeText(roomCodeCreated);
                });
              }}
              style={{
                padding: "4px 14px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-light)",
                cursor: "pointer",
                fontSize: "0.75rem",
                marginBottom: 8,
              }}
            >
              📋 复制分享链接
            </button>
            <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>
              ⏳ 等待对手加入...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

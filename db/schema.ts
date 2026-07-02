// ===================================================================
//  db/schema.ts — 全量数据模型（Drizzle ORM）
// ===================================================================
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ══════════════════════════════════════════════════════════════════
//  game_records — 游戏记录（所有单人模式通用）
// ══════════════════════════════════════════════════════════════════
export const gameRecords = pgTable(
  "game_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id"),
    username: text("username").default("匿名球迷"),
    game_mode: varchar("game_mode", { length: 20 }).notNull(),
    score: integer("score").notNull(),
    result: text("result").notNull(), // "82-0"
    roster: jsonb("roster").$type<{
      player_names: string[];
      decades: string[];
      teams: string[];
      roster_hash: string;
    }>().notNull().default({ player_names: [], decades: [], teams: [], roster_hash: "" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    share_code: varchar("share_code", { length: 12 }).unique(),
    client_fingerprint: text("client_fingerprint"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    modeScoreIdx: index("idx_game_records_mode_score").on(table.game_mode, table.score.desc()),
    userIdIdx: index("idx_game_records_user_id").on(table.user_id),
    shareCodeIdx: uniqueIndex("idx_game_records_share_code").on(table.share_code),
    createdIdx: index("idx_game_records_created").on(table.created_at),
  })
);

// ══════════════════════════════════════════════════════════════════
//  battle_rooms — 双人对战房间
// ══════════════════════════════════════════════════════════════════
export const battleRooms = pgTable(
  "battle_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    room_code: varchar("room_code", { length: 6 }).unique().notNull(),
    host_id: uuid("host_id").notNull(),
    guest_id: uuid("guest_id"),
    status: text("status").notNull().default("waiting"), // waiting / picking / playing / finished
    // 选人阶段
    host_pick_progress: integer("host_pick_progress").default(0),
    guest_pick_progress: integer("guest_pick_progress").default(0),
    host_ready: boolean("host_ready").default(false),
    guest_ready: boolean("guest_ready").default(false),
    host_roster: jsonb("host_roster"),
    guest_roster: jsonb("guest_roster"),
    host_skips: jsonb("host_skips").default({ team: 1, decade: 1 }),
    guest_skips: jsonb("guest_skips").default({ team: 1, decade: 1 }),
    host_nickname: text("host_nickname").default(""),
    guest_nickname: text("guest_nickname").default(""),
    // 公共池抢选
    pick_mode: text("pick_mode").default("independent"), // 'independent' | 'common'
    current_pick_round: integer("current_pick_round").default(0),
    current_picker: uuid("current_picker"),
    common_pool: jsonb("common_pool"), // [{team, decade, players[]}]
    pick_deadline: timestamp("pick_deadline", { withTimezone: true }),
    // 对战阶段
    playoff_state: jsonb("playoff_state"),
    winner_id: uuid("winner_id"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    roomCodeIdx: uniqueIndex("idx_battle_rooms_code").on(table.room_code),
    hostIdx: index("idx_battle_rooms_host").on(table.host_id),
    guestIdx: index("idx_battle_rooms_guest").on(table.guest_id),
  })
);

// ══════════════════════════════════════════════════════════════════
//  battle_history — 对战历史战绩
// ══════════════════════════════════════════════════════════════════
export const battleHistory = pgTable(
  "battle_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    player_id: uuid("player_id").notNull(),
    opponent_id: uuid("opponent_id"),
    opponent_name: text("opponent_name"),
    is_win: boolean("is_win").notNull(),
    series_score: text("series_score").notNull(), // "4-2"
    my_roster: jsonb("my_roster").notNull(),
    opponent_roster: jsonb("opponent_roster"),
    game_details: jsonb("game_details"), // [{hostScore, guestScore, hostWin}]
    room_code: varchar("room_code", { length: 6 }),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    playerIdx: index("idx_battle_history_player").on(table.player_id),
    createdIdx: index("idx_battle_history_created").on(table.created_at),
  })
);

// ══════════════════════════════════════════════════════════════════
//  方案 A 预留：公共池抢选对战（battle_rooms 字段扩展注释）
//  阶段 3+ 启用，当前仅字段定义，不执行 DDL
// ══════════════════════════════════════════════════════════════════
// battle_rooms 扩展字段（在现有表上 ALTER TABLE ADD COLUMN）:
//   pick_mode          text default 'independent'  -- 'independent' | 'common'
//   current_pick_round integer default 0
//   current_picker     uuid                        -- 当前轮次选人权归属
//   common_pool        jsonb                       -- [{team, decade, players[]}]
//   pick_deadline      timestamptz                 -- 超时自动跳过

// ══════════════════════════════════════════════════════════════════
//  battle_pick_log — 公共池选人操作日志
// ══════════════════════════════════════════════════════════════════
export const battlePickLog = pgTable(
  "battle_pick_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    room_code: varchar("room_code", { length: 6 }).notNull(),
    round: integer("round").notNull(),
    picker_id: uuid("picker_id").notNull(),
    player_name: text("player_name").notNull(),
    slot: text("slot").notNull(),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    roomCodeIdx: index("idx_pick_log_room").on(table.room_code),
    pickerIdx: index("idx_pick_log_picker").on(table.picker_id),
  })
);

// ══════════════════════════════════════════════════════════════════
//  profiles — 用户业务表（关联 auth.users）
// ══════════════════════════════════════════════════════════════════
export const profiles = pgTable(
  "profiles",
  {
    user_id: uuid("user_id").primaryKey().notNull(),
    nickname: varchar("nickname", { length: 50 }).notNull().default("匿名玩家"),
    avatar_url: text("avatar_url"),
    total_games: integer("total_games").default(0),
    total_wins: integer("total_wins").default(0),
    best_score: integer("best_score"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nicknameIdx: index("idx_profiles_nickname").on(table.nickname),
  })
);

// export const users = pgTable("users", {
//   id: uuid("id").primaryKey().defaultRandom(),
//   supabase_uid: uuid("supabase_uid").unique().notNull(),
//   nickname: text("nickname").default("匿名球迷"),
//   avatar_url: text("avatar_url"),
//   total_games: integer("total_games").default(0),
//   best_record: text("best_record"), // "82-0"
//   best_wins: integer("best_wins").default(0),
//   created_at: timestamp("created_at").defaultNow(),
//   updated_at: timestamp("updated_at").defaultNow(),
// });

// export const achievements = pgTable("achievements", {
//   id: uuid("id").primaryKey().defaultRandom(),
//   user_id: uuid("user_id").notNull(),
//   achievement_key: text("achievement_key").notNull(), // "first_82_0", "ten_games", etc.
//   unlocked_at: timestamp("unlocked_at").defaultNow(),
// });

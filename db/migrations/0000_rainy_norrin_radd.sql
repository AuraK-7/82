-- ===================================================================
--  0000_rainy_norrin_radd: 初始 schema（v2 最终结构）
-- ===================================================================

-- ══════════════════════════════════════════════════════════════════
--  game_records — 游戏记录（所有单人模式通用）
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "game_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"username" text DEFAULT '匿名球迷',
	"game_mode" varchar(20) NOT NULL,
	"score" integer NOT NULL,
	"result" text NOT NULL,
	"roster" jsonb DEFAULT '{"player_names":[],"decades":[],"teams":[],"roster_hash":""}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"share_code" varchar(12),
	"client_fingerprint" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "game_records_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
--  battle_history — 对战历史战绩
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "battle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"opponent_id" uuid,
	"opponent_name" text,
	"is_win" boolean NOT NULL,
	"series_score" text NOT NULL,
	"my_roster" jsonb NOT NULL,
	"opponent_roster" jsonb,
	"game_details" jsonb,
	"room_code" varchar(6),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
--  battle_pick_log — 公共池选人操作日志
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "battle_pick_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(6) NOT NULL,
	"round" integer NOT NULL,
	"picker_id" uuid NOT NULL,
	"player_name" text NOT NULL,
	"slot" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
--  battle_rooms — 双人对战房间
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "battle_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(6) NOT NULL,
	"host_id" uuid NOT NULL,
	"guest_id" uuid,
	"status" text DEFAULT 'waiting' NOT NULL,
	"host_pick_progress" integer DEFAULT 0,
	"guest_pick_progress" integer DEFAULT 0,
	"host_ready" boolean DEFAULT false,
	"guest_ready" boolean DEFAULT false,
	"host_roster" jsonb,
	"guest_roster" jsonb,
	"host_skips" jsonb DEFAULT '{"team":1,"decade":1}'::jsonb,
	"guest_skips" jsonb DEFAULT '{"team":1,"decade":1}'::jsonb,
	"host_nickname" text DEFAULT '',
	"guest_nickname" text DEFAULT '',
	"pick_mode" text DEFAULT 'independent',
	"current_pick_round" integer DEFAULT 0,
	"current_picker" uuid,
	"common_pool" jsonb,
	"pick_deadline" timestamp with time zone,
	"playoff_state" jsonb,
	"winner_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "battle_rooms_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
--  profiles — 用户资料（关联 auth.users）
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nickname" varchar(50) DEFAULT '匿名玩家' NOT NULL,
	"avatar_url" text,
	"total_games" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	"best_score" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
--  索引
-- ══════════════════════════════════════════════════════════════════

-- game_records
CREATE INDEX IF NOT EXISTS "idx_game_records_mode_score" ON "game_records" USING btree ("game_mode", "score" DESC);
CREATE INDEX IF NOT EXISTS "idx_game_records_user_id" ON "game_records" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_game_records_share_code" ON "game_records" USING btree ("share_code");
CREATE INDEX IF NOT EXISTS "idx_game_records_created" ON "game_records" USING btree ("created_at");

-- battle_history
CREATE INDEX IF NOT EXISTS "idx_battle_history_player" ON "battle_history" USING btree ("player_id");
CREATE INDEX IF NOT EXISTS "idx_battle_history_created" ON "battle_history" USING btree ("created_at");

-- battle_pick_log
CREATE INDEX IF NOT EXISTS "idx_pick_log_room" ON "battle_pick_log" USING btree ("room_code");
CREATE INDEX IF NOT EXISTS "idx_pick_log_picker" ON "battle_pick_log" USING btree ("picker_id");

-- battle_rooms
CREATE UNIQUE INDEX IF NOT EXISTS "idx_battle_rooms_code" ON "battle_rooms" USING btree ("room_code");
CREATE INDEX IF NOT EXISTS "idx_battle_rooms_host" ON "battle_rooms" USING btree ("host_id");
CREATE INDEX IF NOT EXISTS "idx_battle_rooms_guest" ON "battle_rooms" USING btree ("guest_id");

-- profiles
CREATE INDEX IF NOT EXISTS "idx_profiles_nickname" ON "profiles" USING btree ("nickname");

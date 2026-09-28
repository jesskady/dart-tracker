-- Score Chalk: accounts and game history.
--
-- Times are epoch milliseconds (INTEGER) rather than SQLite date strings, so
-- the client and the Worker can both use Date.now() without a format to agree
-- on. Ids are UUIDs generated in the Worker, not autoincrement integers: the
-- client proposes an id when it syncs a game, which is what makes a retried
-- sync land on the same row instead of a duplicate.

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  -- Google's stable subject id. Nullable so a future password or magic-link
  -- account can exist without one; unique so one Google account is one user.
  google_sub   TEXT UNIQUE,
  email        TEXT,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE games (
  id            TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type     TEXT NOT NULL,            -- 'darts'
  -- Rules as played, as JSON: starting score, double in/out, solo or head to
  -- head. Kept whole rather than as columns because the next game type will
  -- not have the same knobs.
  config        TEXT NOT NULL,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,                  -- NULL while unfinished or abandoned
  winner_idx    INTEGER
);
CREATE INDEX idx_games_owner ON games(owner_user_id, started_at DESC);

-- Who played. user_id is nullable on purpose: the opponent is usually just a
-- name typed on the setup screen, and requiring an account for them would
-- break how the app is actually used. The column is here from the start so
-- linking both players later needs no migration.
CREATE TABLE game_players (
  game_id TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  idx     INTEGER NOT NULL,
  name    TEXT    NOT NULL,
  user_id TEXT    REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (game_id, idx)
);

-- One row per submitted turn, holding the darts that made it up.
CREATE TABLE turns (
  id          TEXT    PRIMARY KEY,
  game_id     TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_idx  INTEGER NOT NULL,
  turn_no     INTEGER NOT NULL,
  darts       TEXT    NOT NULL,   -- JSON: [{label,val,dbl}, ...]
  points      INTEGER NOT NULL,   -- scored this turn; 0 on a bust
  bust        INTEGER NOT NULL DEFAULT 0,
  score_after INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  -- Makes syncing idempotent: a turn is identified by where it sits in the
  -- game, so replaying a failed sync updates rather than duplicates.
  UNIQUE (game_id, player_idx, turn_no)
);
CREATE INDEX idx_turns_game ON turns(game_id, turn_no);

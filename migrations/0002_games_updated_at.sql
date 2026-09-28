-- A game can now be saved to a profile mid-play, so two devices can each hold
-- an unfinished copy. updated_at is what tells them apart when offering a
-- resume, and it is maintained by the Worker on every upsert.
ALTER TABLE games ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Serves "my unfinished games, most recent first", which the setup screen asks
-- for on every load when signed in.
CREATE INDEX idx_games_active ON games(owner_user_id, ended_at, updated_at DESC);

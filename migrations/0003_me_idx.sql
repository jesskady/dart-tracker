-- Which player in a game is the account holder.
--
-- Without this a game is two anonymous names and statistics cannot say whose
-- average they are. The client resolves it at save time by matching the
-- signed-in display name against the player names, falling back to 0 — the
-- person entering the scores is nearly always player one.
--
-- Defaulting to 0 also gives the games saved before this column a reasonable
-- answer rather than excluding them from statistics.
ALTER TABLE games ADD COLUMN me_idx INTEGER NOT NULL DEFAULT 0;

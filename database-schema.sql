-- Create teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create players table
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create shots table
CREATE TABLE shots (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  zone INTEGER NOT NULL,
  made BOOLEAN NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security
-- The app uses the Supabase anon key without sign-in. These policies let anon
-- read and insert rows so TeamCreation, Scoring, and DataView queries work:
--   teams: select with players(*); insert teams
--   players: select with teams(name), shots(*); insert players
--   shots: select by player_id; insert shots
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select_anon ON teams;
DROP POLICY IF EXISTS teams_insert_anon ON teams;
CREATE POLICY teams_select_anon ON teams FOR SELECT TO anon USING (true);
CREATE POLICY teams_insert_anon ON teams FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS players_select_anon ON players;
DROP POLICY IF EXISTS players_insert_anon ON players;
CREATE POLICY players_select_anon ON players FOR SELECT TO anon USING (true);
CREATE POLICY players_insert_anon ON players FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS shots_select_anon ON shots;
DROP POLICY IF EXISTS shots_insert_anon ON shots;
CREATE POLICY shots_select_anon ON shots FOR SELECT TO anon USING (true);
CREATE POLICY shots_insert_anon ON shots FOR INSERT TO anon WITH CHECK (true);

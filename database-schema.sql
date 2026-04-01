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

-- Row Level Security (anon key, no sign-in). Run this block if tables already exist:
-- only execute the ALTER / DROP / CREATE section, not CREATE TABLE again.
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select_anon ON teams;
DROP POLICY IF EXISTS teams_insert_anon ON teams;
DROP POLICY IF EXISTS teams_update_anon ON teams;
DROP POLICY IF EXISTS teams_delete_anon ON teams;
CREATE POLICY teams_select_anon ON teams FOR SELECT TO anon USING (true);
CREATE POLICY teams_insert_anon ON teams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY teams_update_anon ON teams FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY teams_delete_anon ON teams FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS players_select_anon ON players;
DROP POLICY IF EXISTS players_insert_anon ON players;
DROP POLICY IF EXISTS players_update_anon ON players;
DROP POLICY IF EXISTS players_delete_anon ON players;
CREATE POLICY players_select_anon ON players FOR SELECT TO anon USING (true);
CREATE POLICY players_insert_anon ON players FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY players_update_anon ON players FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY players_delete_anon ON players FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS shots_select_anon ON shots;
DROP POLICY IF EXISTS shots_insert_anon ON shots;
CREATE POLICY shots_select_anon ON shots FOR SELECT TO anon USING (true);
CREATE POLICY shots_insert_anon ON shots FOR INSERT TO anon WITH CHECK (true);
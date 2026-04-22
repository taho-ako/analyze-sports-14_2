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
  round INTEGER NOT NULL DEFAULT 1,
  zone INTEGER NOT NULL,
  made BOOLEAN NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create team_claims table (one active device claim per team)
CREATE TABLE team_claims (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
);
# Sports Analysis App

A web application for tracking sports teams, players, and scoring with data visualization.
https://c4k-hooplytics.vercel.app/

## Features

- Create up to 4 teams with up to 4 players each
- Two-round flow: round 1 individual leaderboard and round 2 group analytics
- Interactive scoring with heat map zones
- Real-time statistics and accuracy tracking
- Data visualization with charts and tables

## Tech Stack

- Frontend: React (Vite)
- Backend: Supabase
- Hosting: Vercel
- Charts: Recharts

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL in `database-schema.sql` to create tables
    - If your `shots` table already exists, run this migration:
     ```sql
     ALTER TABLE shots ADD COLUMN IF NOT EXISTS round INTEGER NOT NULL DEFAULT 1;
     ```
    - Run this migration for team-device claiming:
       ```sql
       CREATE TABLE IF NOT EXISTS team_claims (
          team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
          client_id TEXT NOT NULL,
          claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
       );
       ```
    - Run this migration for single active host locking:
       ```sql
       CREATE TABLE IF NOT EXISTS host_claims (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          client_id TEXT NOT NULL,
          claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
       );
       ```
   - Copy your Supabase URL and anon key
4. Create `.env` file:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
5. Run: `npm run dev`

## Database Schema

See `database-schema.sql` for the required tables: teams, players, shots.

## Gameplay Rules

- Round 1 is individual scoring. Players should each take 20 shots (tracked manually by participants).
- Round 1 leaderboard in Data View ranks players by total points.
- Round 2 is group scoring. Teams are formed manually by participants.
- Round 2 target allocation is 30 total shots per team, with each player finishing between 5 and 15 shots.
- Round 2 limits are advisory in the app (shown as warnings), not hard-enforced.

Pull before you push: Always run git pull origin main to make sure you have the latest code.

PRs: Open a Pull Request on GitHub before merging into main.

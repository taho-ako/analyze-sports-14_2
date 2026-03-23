# Sports Analysis App

A web application for tracking sports teams, players, and scoring with data visualization.

## Features

- Create up to 4 teams with up to 4 players each
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
   - Copy your Supabase URL and anon key
4. Create `.env` file:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
5. Run: `npm run dev`

## Database Schema

See `database-schema.sql` for the required tables: teams, players, shots.

Pull before you push: Always run git pull origin main to make sure you have the latest code.

PRs: Open a Pull Request on GitHub before merging into main.
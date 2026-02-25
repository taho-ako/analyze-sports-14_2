🏀 Basketball Data Literacy Game
A web-based platform designed to help middle and high school students learn data literacy through a physical basketball game. Built with the React + Supabase + Vercel stack.

👥 The Team
University of Virginia Engineering Foundations 2 Team 14_2

🚀 Tech Stack
Frontend: React (via Vite)

Hosting: Vercel

Backend/Database: Supabase

Realtime: Supabase Realtime (for Kahoot-style updates)

🛠️ Getting Started
Follow these steps to get the project running on your local machine.

1. Clone the repository
Bash
git clone [YOUR_GITHUB_URL]
cd [YOUR_REPO_NAME]
2. Install dependencies
Bash
npm install
3. Setup Environment Variables
Since we don't push secrets to GitHub, you need to create your own local .env file.

Create a file named .env in the root folder.

Copy the contents of .env.example into .env.

Ask the team lead for the Supabase URL and Anon Key, and paste them in.

4. Run the development server
Bash
npm run dev
The app should now be running at http://localhost:5173.

📁 Project Structure (Current)
/src

/components - Reusable UI elements.

/pages - Main views (Host Dashboard, Player Join, etc.).

supabaseClient.js - Our connection to the database.

📝 Workflow Rules
Don't code on main: Create a new branch for every feature (git checkout -b feature/feature-name).

Pull before you push: Always run git pull origin main to make sure you have the latest code.

PRs: Open a Pull Request on GitHub before merging into main.
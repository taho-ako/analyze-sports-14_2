import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import TeamCreation from './components/TeamCreation'
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import './App.css'

function App() {
  const [userRole, setUserRole] = useState(null)
  const [gameId, setGameId] = useState('34583d69-c4ea-4aa5-b208-612cc6a0a581');
  const [currentRound, setCurrentRound] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Fetch initial row to get the ID and current round
    const fetchGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('id, current_round')
        .limit(1)
        .single()
      
      if (data) {
        setGameId(data.id)
        setCurrentRound(data.current_round)
      } else if (error) {
        console.error("Error fetching game:", error)
      }
      setLoading(false)
    }
    fetchGame()

    // 2. Realtime listener for the 'current_round' column
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, 
        (payload) => {
          setCurrentRound(payload.new.current_round)
        }
      ).subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // 3. Helper to start the game (Moves to round 1 using the stored gameId)
  const handleStartGame = async () => {
    if (!gameId) return alert("Game ID not found!");

    const { error } = await supabase
      .from('games')
      .update({ current_round: 1 })
      .eq('id', gameId) // Uses the correct UUID

    if (error) console.error("Error starting game:", error)
  }

  if (loading) return <div className="loading">Connecting...</div>

  if (!userRole) {
    return (
      <div className="landing-container">
        <button className="huge-btn host" onClick={() => setUserRole('host')}>Host a Game</button>
        <button className="huge-btn join" onClick={() => setUserRole('player')}>Join a Game</button>
      </div>
    )
  }

  const isGameStarted = currentRound > 0

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <img className="uva-logo" src="uva logo.png" alt="UVA logo" width="64" />
          <h1 onClick={() => {setUserRole(null);}} style={{cursor: 'pointer'}}>Hooplytics</h1>
        </header>

        <Routes>
          <Route path="/" element={
            userRole === 'host' ? (
              <TeamCreation isGameStarted={isGameStarted} onStartGame={handleStartGame} />
            ) : (
              isGameStarted ? <Navigate to="/scoring" /> : <WaitingRoom />
            )
          } />
          <Route path="/scoring" element={isGameStarted ? <Scoring currentRound={currentRound} /> : <Navigate to="/" />} />
          <Route path="/data" element={<DataView />} />
        </Routes>
      </div>
    </Router>
  )
}

function WaitingRoom() {
  return (
    <div className="waiting-room">
      <div className="loader">🏀</div>
      <h2>Waiting for instructor to start the game...</h2>
    </div>
  )
}

export default App
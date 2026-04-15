import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TeamCreation from './components/TeamCreation'
import EnterCodePage from './components/EnterCodePage' // This will become our Waiting screen
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import './App.css'

function App() {
  const [userRole, setUserRole] = useState(null)
  const [isGameStarted, setIsGameStarted] = useState(false) // Tracking the game status

  if (!userRole) {
    return (
      <div className="landing-container">
        <button className="huge-btn host" onClick={() => setUserRole('host')}>
          Host a Game
        </button>
        <button className="huge-btn join" onClick={() => setUserRole('player')}>
          Join a Game
        </button>
      </div>
    )
  }

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <img className="uva-logo" src="uva logo.png" alt="UVA logo" width="64" />
          <h1 onClick={() => {setUserRole(null); setIsGameStarted(false);}} style={{cursor: 'pointer'}}>
            Hooplytics
          </h1>
        </header>

        <Routes>
          {userRole === 'host' ? (
            /* TEACHER: Starts in Team Creation */
            <Route path="/" element={
              <TeamCreation 
                isGameStarted={isGameStarted} 
                onStartGame={() => setIsGameStarted(true)} 
              />
            } />
          ) : (
            /* STUDENT: Starts in Waiting Room if game isn't started */
            <Route path="/" element={
              isGameStarted ? <Navigate to="/scoring" /> : <WaitingRoom />
            } />
          )}

          <Route path="/scoring" element={<Scoring />} />
          <Route path="/data" element={<DataView />} />
        </Routes>
      </div>
    </Router>
  )
}

// Simple Waiting Room Component
function WaitingRoom() {
  return (
    <div className="waiting-room">
      <div className="loader">🏀</div>
      <h2>Waiting for instructor to start the game...</h2>
      <p>Get ready to track some shots!</p>
    </div>
  )
}

export default App
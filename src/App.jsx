import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import TeamCreation from './components/TeamCreation'
import EnterCodePage from './components/EnterCodePage'
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import './App.css'


function App() {
  const [userRole, setUserRole] = useState(null)

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
          {/* Clicking the title resets the app so you can switch roles */}
          <h1 onClick={() => setUserRole(null)} style={{cursor: 'pointer'}}>
            Hooplytics
          </h1>
        </header>

        <Routes>
          {/* If Host, the "/" path goes to Team Creation. If Join, it goes to Enter Code. */}
          <Route 
            path="/" 
            element={userRole === 'host' ? <TeamCreation /> : <EnterCodePage />} 
          />
          
          {/* These stay accessible for everyone */}
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/data" element={<DataView />} />
          
          {/* Redirects to help keep navigation clean */}
          <Route path="/lobby" element={<TeamCreation />} />
        </Routes>
      </div>
    </Router>
  )

  /*
  OLD CODE FOR REFERENCE
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <img
            className="uva-logo"
            src="uva logo.png"
            alt="UVA logo"
            width="64"
            height="64"
          />
          <h1>Hooplytics</h1>
        </header>
        <nav>
          <Link to="/lobby">Team Creation</Link>
          <Link to="/scoring">Scoring</Link>
          <Link to="/data">Data View</Link>
        </nav>
        <Routes>
          <Route path="/" element={<EnterCodePage />} />
          <Route path="/lobby" element={<TeamCreation />} />
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/data" element={<DataView />} />
        </Routes>
      </div>
    </Router>
  )*/
    
}

export default App

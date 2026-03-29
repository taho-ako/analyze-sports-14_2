import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import TeamCreation from './components/TeamCreation'
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import './App.css'

function App() {
  return (
    <Router>F
      <div className="app">
        <header className="app-header">
          <img
            className="uva-logo"
            src="uva logo.png"
            alt="UVA logo"
            width="64"
            height="64"
          />
          <h1>Analyze Sports</h1>
        </header>
        <nav>
          <Link to="/">Team Creation</Link>
          <Link to="/scoring">Scoring</Link>
          <Link to="/data">Data View</Link>
        </nav>
        <Routes>
          <Route path="/" element={<TeamCreation />} />
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/data" element={<DataView />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import TeamCreation from './components/TeamCreation'
import EnterCodePage from './components/EnterCodePage'
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
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
  )
}

export default App

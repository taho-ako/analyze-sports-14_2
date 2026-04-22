import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import TeamCreation from './components/TeamCreation'
import Scoring from './components/Scoring'
import DataView from './components/DataView'
import Scoreboard from './components/Scoreboard'
import './App.css'

const GAME_PHASES = {
  PRE_GAME: 0,
  ROUND_1_LIVE: 1,
  ROUND_1_ENDED: 2,
  ROUND_2_LIVE: 3,
  ROUND_2_ENDED: 4
}
const LOCAL_GAME_PHASE_KEY = 'local_game_phase'

const getRoundLabel = (phase) => {
  if (phase === GAME_PHASES.ROUND_1_LIVE) return 'Round 1 is live'
  if (phase === GAME_PHASES.ROUND_1_ENDED) return 'Round 1 complete'
  if (phase === GAME_PHASES.ROUND_2_LIVE) return 'Round 2 is live'
  if (phase === GAME_PHASES.ROUND_2_ENDED) return 'Round 2 complete - game finished'
  return 'Waiting for host'
}

const getSnakeTeamOrder = (teamCount) => {
  if (teamCount <= 1) return [0]

  const forward = Array.from({ length: teamCount }, (_, index) => index)
  const backward = Array.from({ length: Math.max(0, teamCount - 2) }, (_, index) => teamCount - 2 - index)
  return [...forward, ...backward]
}

const getRoundOnePoints = (player) => {
  const shots = Array.isArray(player?.shots) ? player.shots : []
  return shots
    .filter(shot => Number(shot?.round || 1) === 1)
    .reduce((sum, shot) => sum + Number(shot?.points || 0), 0)
}

function App() {
  const [userRole, setUserRole] = useState(null)
  const [gameId, setGameId] = useState('34583d69-c4ea-4aa5-b208-612cc6a0a581');
  const [currentRound, setCurrentRound] = useState(0)
  const [loading, setLoading] = useState(true)
  const hasSupabase = Boolean(supabase)

  useEffect(() => {
    if (!hasSupabase) {
      const storedPhase = Number(localStorage.getItem(LOCAL_GAME_PHASE_KEY))
      if (Number.isInteger(storedPhase) && storedPhase >= GAME_PHASES.PRE_GAME && storedPhase <= GAME_PHASES.ROUND_2_ENDED) {
        setCurrentRound(storedPhase)
      } else {
        localStorage.setItem(LOCAL_GAME_PHASE_KEY, String(GAME_PHASES.PRE_GAME))
      }

      const syncLocalPhase = (event) => {
        if (event.key !== LOCAL_GAME_PHASE_KEY || event.newValue == null) return
        const nextPhase = Number(event.newValue)
        if (Number.isInteger(nextPhase)) {
          setCurrentRound(nextPhase)
        }
      }

      window.addEventListener('storage', syncLocalPhase)
      setLoading(false)
      return () => window.removeEventListener('storage', syncLocalPhase)
    }

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
  }, [hasSupabase])

  const updateGamePhase = async (nextPhase) => {
    if (!hasSupabase) {
      setCurrentRound(nextPhase)
      localStorage.setItem(LOCAL_GAME_PHASE_KEY, String(nextPhase))
      return
    }

    if (!gameId) return alert('Game ID not found!')

    const { error } = await supabase
      .from('games')
      .update({ current_round: nextPhase })
      .eq('id', gameId)

    if (error) {
      console.error('Error updating game phase:', error)
      return
    }

    setCurrentRound(nextPhase)
  }

  const clearAllShots = async () => {
    if (hasSupabase) {
      const { error } = await supabase
        .from('shots')
        .delete()
        .gte('id', 1)

      if (error) {
        console.error('Error clearing shots for restart:', error)
        return false
      }

      return true
    }

    localStorage.setItem('shots', JSON.stringify([]))
    return true
  }

  const rebalanceTeamsAfterRoundOne = async () => {
    if (hasSupabase) {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .order('id', { ascending: true })

      if (teamsError) {
        console.error('Error loading teams for rebalance:', teamsError)
        return false
      }

      const teamsList = teamsData || []
      if (teamsList.length <= 1) return true

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, shots(round, points)')

      if (playersError) {
        console.error('Error loading players for rebalance:', playersError)
        return false
      }

      const rankedPlayers = (playersData || [])
        .map(player => ({
          ...player,
          roundOnePoints: getRoundOnePoints(player)
        }))
        .sort((left, right) => {
          if (right.roundOnePoints !== left.roundOnePoints) {
            return right.roundOnePoints - left.roundOnePoints
          }
          return String(left.name).localeCompare(String(right.name))
        })

      const snakeOrder = getSnakeTeamOrder(teamsList.length)
      const assignments = new Map()

      rankedPlayers.forEach((player, index) => {
        const teamIndex = snakeOrder[index % snakeOrder.length]
        assignments.set(player.id, teamsList[teamIndex].id)
      })

      const updateResults = await Promise.all(
        rankedPlayers.map(player =>
          supabase
            .from('players')
            .update({ team_id: assignments.get(player.id) })
            .eq('id', player.id)
        )
      )

      const failedUpdate = updateResults.find(result => result.error)
      if (failedUpdate?.error) {
        console.error('Error assigning fair teams:', failedUpdate.error)
        return false
      }

      return true
    }

    const localTeams = JSON.parse(localStorage.getItem('teams') || '[]')
    if (localTeams.length <= 1) return true

    const localShots = JSON.parse(localStorage.getItem('shots') || '[]')
    const players = localTeams.flatMap(team =>
      (team.players || []).map(player => ({ ...player }))
    )

    const playersWithPoints = players
      .map(player => {
        const roundOnePoints = localShots
          .filter(shot => String(shot.player_id) === String(player.id) && Number(shot.round || 1) === 1)
          .reduce((sum, shot) => sum + Number(shot.points || 0), 0)

        return {
          ...player,
          roundOnePoints
        }
      })
      .sort((left, right) => {
        if (right.roundOnePoints !== left.roundOnePoints) {
          return right.roundOnePoints - left.roundOnePoints
        }
        return String(left.name).localeCompare(String(right.name))
      })

    const resetTeams = localTeams.map(team => ({
      ...team,
      players: []
    }))
    const snakeOrder = getSnakeTeamOrder(resetTeams.length)

    playersWithPoints.forEach((player, index) => {
      const teamIndex = snakeOrder[index % snakeOrder.length]
      resetTeams[teamIndex].players.push({
        id: player.id,
        name: player.name
      })
    })

    localStorage.setItem('teams', JSON.stringify(resetTeams))
    return true
  }

  const handleStartRoundOne = () => updateGamePhase(GAME_PHASES.ROUND_1_LIVE)
  const handleEndRoundOne = async () => {
    const sorted = await rebalanceTeamsAfterRoundOne()
    if (!sorted) {
      alert('Could not sort teams fairly. Please try again.')
      return
    }

    await updateGamePhase(GAME_PHASES.ROUND_1_ENDED)
  }
  const handleStartRoundTwo = () => updateGamePhase(GAME_PHASES.ROUND_2_LIVE)
  const handleEndRoundTwo = () => updateGamePhase(GAME_PHASES.ROUND_2_ENDED)
  const handleEndGameAnytime = async () => {
    const shouldEnd = window.confirm('End the game now and show the final scoreboard?')
    if (!shouldEnd) return

    await updateGamePhase(GAME_PHASES.ROUND_2_ENDED)
  }

  const handleRestartAfterFinal = async () => {
    const shouldRestart = window.confirm('Restart game and clear all shots from rounds 1 and 2?')
    if (!shouldRestart) return

    const cleared = await clearAllShots()
    if (!cleared) {
      alert('Could not clear shot data. Please try again.')
      return
    }

    await updateGamePhase(GAME_PHASES.PRE_GAME)
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

  const isRoundLive = currentRound === GAME_PHASES.ROUND_1_LIVE || currentRound === GAME_PHASES.ROUND_2_LIVE
  const activeScoringRound = currentRound === GAME_PHASES.ROUND_2_LIVE ? 2 : 1

  const renderPlayerHome = () => {
    if (currentRound === GAME_PHASES.ROUND_1_LIVE || currentRound === GAME_PHASES.ROUND_2_LIVE) {
      return <Navigate to="/scoring" />
    }

    if (currentRound === GAME_PHASES.ROUND_1_ENDED) {
      return (
        <WaitingRoom
          title="Round 1 finished"
          subtitle="Host is organizing fair teams before Round 2 starts."
        />
      )
    }

    if (currentRound === GAME_PHASES.ROUND_2_ENDED) {
      return <Navigate to="/scoreboard" />
    }

    return (
      <WaitingRoom
        title="Waiting for host"
        subtitle="Host controls when rounds start and end."
      />
    )
  }

  return (
    <Router>
      <div className="app">
        {!hasSupabase && (
          <p style={{ color: 'red', textAlign: 'center', margin: '8px 0' }}>
            Missing Supabase environment variables. Running with local-only behavior.
          </p>
        )}
        <header className="app-header">
          <img className="uva-logo" src="uva logo.png" alt="UVA logo" width="64" />
          <h1 onClick={() => {setUserRole(null);}} style={{cursor: 'pointer'}}>Hooplytics</h1>
          <p style={{ marginLeft: 'auto', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
            {getRoundLabel(currentRound)}
          </p>
        </header>

        <nav>
          {currentRound !== GAME_PHASES.ROUND_2_ENDED && <Link to="/">Home</Link>}
          {isRoundLive && <Link to="/scoring">Scoring</Link>}
          {currentRound === GAME_PHASES.ROUND_2_ENDED && <Link to="/scoreboard">Scoreboard</Link>}
          <Link to="/data">Data View</Link>
        </nav>

        <Routes>
          <Route path="/" element={
            userRole === 'host' ? (
              currentRound === GAME_PHASES.ROUND_2_ENDED ? (
                <Navigate to="/scoreboard" />
              ) : (
                <TeamCreation
                  currentRound={currentRound}
                  onStartRoundOne={handleStartRoundOne}
                  onEndRoundOne={handleEndRoundOne}
                  onStartRoundTwo={handleStartRoundTwo}
                  onEndRoundTwo={handleEndRoundTwo}
                  onEndGameAnytime={handleEndGameAnytime}
                />
              )
            ) : (
              renderPlayerHome()
            )
          } />
          <Route
            path="/scoring"
            element={
              isRoundLive
                ? <Scoring lockedRound={activeScoringRound} roundLocked={true} />
                : <Navigate to="/" />
            }
          />
          <Route path="/data" element={<DataView />} />
          <Route
            path="/scoreboard"
            element={
              <Scoreboard
                canRestart={userRole === 'host' && currentRound === GAME_PHASES.ROUND_2_ENDED}
                onRestartGame={handleRestartAfterFinal}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

function WaitingRoom({ title, subtitle }) {
  return (
    <div className="waiting-room">
      <div className="loader">🏀</div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

export default App
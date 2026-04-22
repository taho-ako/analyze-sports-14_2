import { useState, useEffect, useCallback } from 'react'
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

const CLAIM_TTL_MS = 20 * 60 * 1000
const LOCAL_GAME_PHASE_KEY = 'local_game_phase'
const LOCAL_TEAM_CLAIMS_KEY = 'local_team_claims'
const LOCAL_CLIENT_ID_KEY = 'hooplytics_client_id'
const LOCAL_CLAIMED_TEAM_KEY = 'hooplytics_claimed_team_id'

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

const nowIso = () => new Date().toISOString()

const isClaimActive = (claim) => {
  const timestamp = claim?.last_active_at || claim?.claimed_at
  if (!timestamp) return false
  const parsed = new Date(timestamp).getTime()
  if (!Number.isFinite(parsed)) return false
  return (Date.now() - parsed) <= CLAIM_TTL_MS
}

const readLocalClaims = () => {
  const raw = localStorage.getItem(LOCAL_TEAM_CLAIMS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeLocalClaims = (claims) => {
  localStorage.setItem(LOCAL_TEAM_CLAIMS_KEY, JSON.stringify(claims))
}

const getOrCreateClientId = () => {
  const existingId = localStorage.getItem(LOCAL_CLIENT_ID_KEY)
  if (existingId) return existingId

  const generatedId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(LOCAL_CLIENT_ID_KEY, generatedId)
  return generatedId
}

function TeamJoinPanel({ teams, claims, claimedTeamId, onClaimTeam }) {
  const activeClaims = claims.filter(isClaimActive)

  const getClaimForTeam = (teamId) => activeClaims.find(claim => String(claim.team_id) === String(teamId))

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.4rem' }}>Join a Team Device</h1>
      <p style={{ marginTop: 0, color: 'rgba(255,255,255,0.8)' }}>
        Each classroom device can control exactly one team. Claims expire after 20 minutes of inactivity.
      </p>

      {claimedTeamId && (
        <p style={{ color: '#86efac', fontWeight: 700 }}>
          You are currently assigned to team ID {claimedTeamId}.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.8rem', marginTop: '1rem' }}>
        {teams.map(team => {
          const teamClaim = getClaimForTeam(team.id)
          const isClaimed = Boolean(teamClaim)
          const isYourTeam = String(claimedTeamId) === String(team.id)

          return (
            <div
              key={team.id}
              style={{
                border: '1px solid rgba(79, 163, 255, 0.3)',
                borderRadius: '10px',
                padding: '0.9rem',
                backgroundColor: 'rgba(79, 163, 255, 0.08)'
              }}
            >
              <h3 style={{ margin: 0, color: '#fff' }}>{team.name}</h3>
              <p style={{ margin: '0.35rem 0 0.7rem', color: 'rgba(255,255,255,0.75)' }}>
                {isYourTeam ? 'Assigned to this device' : isClaimed ? 'Claimed by another device' : 'Available'}
              </p>

              <button
                onClick={() => onClaimTeam(team.id)}
                disabled={isClaimed && !isYourTeam}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  cursor: (isClaimed && !isYourTeam) ? 'not-allowed' : 'pointer',
                  backgroundColor: isYourTeam ? '#16a34a' : '#2563eb',
                  color: '#fff',
                  opacity: (isClaimed && !isYourTeam) ? 0.45 : 1
                }}
              >
                {isYourTeam ? 'Joined' : 'Join Team'}
              </button>
            </div>
          )
        })}
      </div>

      {teams.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.8)' }}>
          No teams generated yet. Wait for host to generate teams.
        </p>
      )}
    </div>
  )
}

function App() {
  const [userRole, setUserRole] = useState(null)
  const [gameId, setGameId] = useState('34583d69-c4ea-4aa5-b208-612cc6a0a581')
  const [currentRound, setCurrentRound] = useState(0)
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [teamClaims, setTeamClaims] = useState([])
  const [claimedTeamId, setClaimedTeamId] = useState(null)
  const hasSupabase = Boolean(supabase)
  const [clientId] = useState(() => getOrCreateClientId())

  const refreshTeams = useCallback(async () => {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('id', { ascending: true })

      if (error) {
        console.error('Error loading teams:', error)
        return []
      }

      const loadedTeams = data || []
      setTeams(loadedTeams)
      return loadedTeams
    }

    const localTeams = JSON.parse(localStorage.getItem('teams') || '[]')
    setTeams(localTeams)
    return localTeams
  }, [hasSupabase])

  const refreshClaims = useCallback(async () => {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('team_claims')
        .select('team_id, client_id, claimed_at, last_active_at')

      if (error) {
        console.error('Error loading team claims:', error)
        setTeamClaims([])
        return []
      }

      const activeClaims = (data || []).filter(isClaimActive)
      const expiredTeamIds = (data || [])
        .filter(claim => !isClaimActive(claim))
        .map(claim => claim.team_id)

      if (expiredTeamIds.length > 0) {
        await supabase
          .from('team_claims')
          .delete()
          .in('team_id', expiredTeamIds)
      }

      setTeamClaims(activeClaims)
      return activeClaims
    }

    const localClaims = readLocalClaims()
    const activeClaims = localClaims.filter(isClaimActive)
    writeLocalClaims(activeClaims)
    setTeamClaims(activeClaims)
    return activeClaims
  }, [hasSupabase])

  useEffect(() => {
    if (!hasSupabase) {
      const storedPhase = Number(localStorage.getItem(LOCAL_GAME_PHASE_KEY))
      if (Number.isInteger(storedPhase) && storedPhase >= GAME_PHASES.PRE_GAME && storedPhase <= GAME_PHASES.ROUND_2_ENDED) {
        setCurrentRound(storedPhase)
      } else {
        localStorage.setItem(LOCAL_GAME_PHASE_KEY, String(GAME_PHASES.PRE_GAME))
      }

      const syncLocalPhase = (event) => {
        if (event.key === LOCAL_GAME_PHASE_KEY && event.newValue != null) {
          const nextPhase = Number(event.newValue)
          if (Number.isInteger(nextPhase)) {
            setCurrentRound(nextPhase)
          }
        }

        if (event.key === LOCAL_TEAM_CLAIMS_KEY) {
          refreshClaims()
        }

        if (event.key === 'teams') {
          refreshTeams()
        }
      }

      window.addEventListener('storage', syncLocalPhase)
      setLoading(false)
      return () => window.removeEventListener('storage', syncLocalPhase)
    }

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
        console.error('Error fetching game:', error)
      }
      setLoading(false)
    }

    fetchGame()

    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, (payload) => {
        setCurrentRound(payload.new.current_round)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [hasSupabase, refreshClaims, refreshTeams])

  useEffect(() => {
    refreshTeams()
    refreshClaims()
  }, [refreshTeams, refreshClaims])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshTeams()
      refreshClaims()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [refreshClaims, refreshTeams])

  useEffect(() => {
    if (!hasSupabase) return undefined

    const channel = supabase
      .channel('team-claim-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => refreshTeams())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_claims' }, () => refreshClaims())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [hasSupabase, refreshClaims, refreshTeams])

  useEffect(() => {
    if (!claimedTeamId) return

    const teamExists = teams.some(team => String(team.id) === String(claimedTeamId))
    if (!teamExists) {
      setClaimedTeamId(null)
      localStorage.removeItem(LOCAL_CLAIMED_TEAM_KEY)
    }
  }, [claimedTeamId, teams])

  useEffect(() => {
    if (userRole !== 'player' || !claimedTeamId) return

    const activeOwnClaim = teamClaims.find(claim =>
      String(claim.team_id) === String(claimedTeamId) &&
      claim.client_id === clientId &&
      isClaimActive(claim)
    )

    if (!activeOwnClaim) {
      setClaimedTeamId(null)
      localStorage.removeItem(LOCAL_CLAIMED_TEAM_KEY)
    }
  }, [claimedTeamId, clientId, teamClaims, userRole])

  useEffect(() => {
    if (userRole !== 'player') return

    const syncPlayerClaim = async () => {
      const claims = await refreshClaims()
      const persistedClaim = localStorage.getItem(LOCAL_CLAIMED_TEAM_KEY)

      const activeOwnClaim = claims.find(claim => claim.client_id === clientId && isClaimActive(claim))
      if (activeOwnClaim) {
        setClaimedTeamId(activeOwnClaim.team_id)
        localStorage.setItem(LOCAL_CLAIMED_TEAM_KEY, String(activeOwnClaim.team_id))
        return
      }

      if (persistedClaim) {
        localStorage.removeItem(LOCAL_CLAIMED_TEAM_KEY)
      }
      setClaimedTeamId(null)
    }

    syncPlayerClaim()
  }, [clientId, refreshClaims, userRole])

  useEffect(() => {
    if (userRole !== 'player' || !claimedTeamId) return undefined

    const heartbeat = async () => {
      if (hasSupabase) {
        await supabase
          .from('team_claims')
          .update({ last_active_at: nowIso() })
          .eq('team_id', claimedTeamId)
          .eq('client_id', clientId)
      } else {
        const claims = readLocalClaims()
        const updatedClaims = claims.map(claim =>
          String(claim.team_id) === String(claimedTeamId) && claim.client_id === clientId
            ? { ...claim, last_active_at: nowIso() }
            : claim
        )
        writeLocalClaims(updatedClaims)
        setTeamClaims(updatedClaims.filter(isClaimActive))
      }
    }

    heartbeat()
    const intervalId = window.setInterval(heartbeat, 60 * 1000)

    return () => window.clearInterval(intervalId)
  }, [claimedTeamId, clientId, hasSupabase, userRole])

  const clearAllClaims = async () => {
    if (hasSupabase) {
      const { error } = await supabase
        .from('team_claims')
        .delete()
        .gte('team_id', 1)

      if (error) {
        console.error('Error clearing team claims:', error)
        return false
      }
    } else {
      writeLocalClaims([])
      localStorage.removeItem(LOCAL_CLAIMED_TEAM_KEY)
    }

    setTeamClaims([])
    setClaimedTeamId(null)
    return true
  }

  const claimTeam = async (teamId) => {
    const claims = await refreshClaims()
    const teamClaim = claims.find(claim => String(claim.team_id) === String(teamId))
    const existingOwnClaim = claims.find(claim => claim.client_id === clientId)

    if (teamClaim && teamClaim.client_id !== clientId) {
      alert('That team is already claimed by another device.')
      return
    }

    if (existingOwnClaim && String(existingOwnClaim.team_id) !== String(teamId)) {
      alert('This device already controls another team.')
      return
    }

    const claimPayload = {
      team_id: teamId,
      client_id: clientId,
      claimed_at: nowIso(),
      last_active_at: nowIso()
    }

    if (hasSupabase) {
      const { error } = await supabase
        .from('team_claims')
        .upsert([claimPayload], { onConflict: 'team_id' })

      if (error) {
        console.error('Error claiming team:', error)
        alert('Could not claim this team. Ensure team_claims table exists.')
        return
      }
    } else {
      const localClaims = readLocalClaims().filter(claim => String(claim.team_id) !== String(teamId))
      localClaims.push(claimPayload)
      writeLocalClaims(localClaims)
    }

    setClaimedTeamId(teamId)
    localStorage.setItem(LOCAL_CLAIMED_TEAM_KEY, String(teamId))
    await refreshClaims()
  }

  const releaseTeamClaim = async (teamId) => {
    if (hasSupabase) {
      const { error } = await supabase
        .from('team_claims')
        .delete()
        .eq('team_id', teamId)

      if (error) {
        console.error('Error releasing claim:', error)
        return
      }
    } else {
      const claims = readLocalClaims().filter(claim => String(claim.team_id) !== String(teamId))
      writeLocalClaims(claims)
    }

    if (String(claimedTeamId) === String(teamId)) {
      setClaimedTeamId(null)
      localStorage.removeItem(LOCAL_CLAIMED_TEAM_KEY)
    }

    await refreshClaims()
  }

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

    const clearedShots = await clearAllShots()
    const clearedClaims = await clearAllClaims()

    if (!clearedShots || !clearedClaims) {
      alert('Could not fully restart game. Please try again.')
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
  const claimedTeamName = teams.find(team => String(team.id) === String(claimedTeamId))?.name || null

  const renderPlayerHome = () => {
    if (!claimedTeamId) {
      return (
        <TeamJoinPanel
          teams={teams}
          claims={teamClaims}
          claimedTeamId={claimedTeamId}
          onClaimTeam={claimTeam}
        />
      )
    }

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
          <h1 onClick={() => { setUserRole(null) }} style={{ cursor: 'pointer' }}>Hooplytics</h1>
          {userRole === 'player' && claimedTeamName && (
            <p style={{ marginLeft: 'auto', marginRight: '0.8rem', color: '#86efac', fontWeight: 700 }}>
              Your Team: {claimedTeamName}
            </p>
          )}
          <p style={{ marginLeft: claimedTeamName ? 0 : 'auto', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
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
          <Route
            path="/"
            element={
              userRole === 'host'
                ? (
                  currentRound === GAME_PHASES.ROUND_2_ENDED
                    ? <Navigate to="/scoreboard" />
                    : (
                      <TeamCreation
                        currentRound={currentRound}
                        onStartRoundOne={handleStartRoundOne}
                        onEndRoundOne={handleEndRoundOne}
                        onStartRoundTwo={handleStartRoundTwo}
                        onEndRoundTwo={handleEndRoundTwo}
                        onEndGameAnytime={handleEndGameAnytime}
                        teamClaims={teamClaims}
                        onReleaseTeamClaim={releaseTeamClaim}
                        onTeamsRegenerated={clearAllClaims}
                      />
                    )
                )
                : renderPlayerHome()
            }
          />
          <Route
            path="/scoring"
            element={
              isRoundLive
                ? (
                  userRole === 'host'
                    ? <Scoring lockedRound={activeScoringRound} roundLocked={true} isHost={true} />
                    : (
                      claimedTeamId
                        ? <Scoring lockedRound={activeScoringRound} roundLocked={true} isHost={false} claimedTeamId={claimedTeamId} />
                        : <Navigate to="/" />
                    )
                )
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

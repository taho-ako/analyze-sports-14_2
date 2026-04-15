import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const TEAM_COLOR_NAMES = ['Blue Team', 'Red Team', 'Green Team', 'Yellow Team']

const getGeneratedTeamNames = (totalTeams) => TEAM_COLOR_NAMES.slice(0, totalTeams)
const idsMatch = (left, right) => String(left) === String(right)
const getDefaultPointsByZone = (zone) => (zone === 1 ? 1 : zone <= 3 ? 2 : 3)

const toRestoredShotCore = (shot, playerId) => {
  const zone = Number(shot?.zone)
  if (!Number.isInteger(zone) || zone < 1) return null

  const roundValue = Number(shot?.round)
  const round = Number.isInteger(roundValue) && roundValue > 0 ? roundValue : 1

  const pointsValue = Number(shot?.points)
  const points = Number.isFinite(pointsValue) ? pointsValue : getDefaultPointsByZone(zone)

  return {
    player_id: playerId,
    round,
    zone,
    made: Boolean(shot?.made),
    points
  }
}

const toLocalRestoredShot = (shot, playerId, shotId) => {
  const shotCore = toRestoredShotCore(shot, playerId)
  if (!shotCore) return null

  return {
    id: shotId,
    ...shotCore
  }
}

function TeamCreation({ onStartGame, isGameStarted}) {
  const [teams, setTeams] = useState([])
  const [teamCount, setTeamCount] = useState(4)
  const [playerCount, setPlayerCount] = useState(16)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeMovePlayerId, setActiveMovePlayerId] = useState(null)
  const [recentlyDeletedPlayers, setRecentlyDeletedPlayers] = useState([])
  const [restoreTeamByPlayerKey, setRestoreTeamByPlayerKey] = useState({})
  const [notification, setNotification] = useState(null)

  const fetchTeams = useCallback(async () => {
    if (supabase) {
      const { data, error } = await supabase.from('teams').select('*, players(*)')
      if (error) console.error(error)
      else setTeams(data)
    } else {
      const localTeams = JSON.parse(localStorage.getItem('teams') || '[]')
      setTeams(localTeams)
    }
  }, [])

  const showNotification = (message) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  const getBalancedRosterPreview = useCallback(() => {
    const safeTeamCount = Math.max(1, Number(teamCount) || 1)
    const safePlayerCount = Math.max(0, Number(playerCount) || 0)
    const baseCount = Math.floor(safePlayerCount / safeTeamCount)
    const extraPlayers = safePlayerCount % safeTeamCount

    return Array.from({ length: safeTeamCount }, (_, index) => baseCount + (index < extraPlayers ? 1 : 0))
  }, [teamCount, playerCount])

  const buildLocalRoster = (totalTeams, totalPlayers) => {
    const timeBase = Date.now()
    const generatedTeamNames = getGeneratedTeamNames(totalTeams)
    const generatedTeams = Array.from({ length: totalTeams }, (_, index) => ({
      id: timeBase + index,
      name: generatedTeamNames[index],
      players: []
    }))

    for (let index = 0; index < totalPlayers; index++) {
      const targetTeamIndex = index % totalTeams
      generatedTeams[targetTeamIndex].players.push({
        id: timeBase + totalTeams + index,
        name: `Player ${index + 1}`
      })
    }

    return generatedTeams
  }

  useEffect(() => {
    fetchTeams()

    const handleUnload = () => {
      if (!supabase) {
        localStorage.removeItem('teams')
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [fetchTeams])

  const generateTeamsAndPlayers = async () => {
    const safeTeamCount = Number(teamCount)
    const safePlayerCount = Number(playerCount)

    if (!Number.isInteger(safeTeamCount) || safeTeamCount < 1 || safeTeamCount > 4) {
      return showNotification('Choose between 1 and 4 teams')
    }

    if (!Number.isInteger(safePlayerCount) || safePlayerCount < 1 || safePlayerCount > 18) {
      return showNotification('Players must be between 1 and 18')
    }

    const generatedTeamNames = getGeneratedTeamNames(safeTeamCount)

    setIsGenerating(true)

    try {
      if (supabase) {
        const { error: deleteTeamsError } = await supabase
          .from('teams')
          .delete()
          .gte('id', 1)

        if (deleteTeamsError) {
          console.error(deleteTeamsError)
          return showNotification('Unable to clear existing teams')
        }

        const { data: createdTeams, error: createTeamsError } = await supabase
          .from('teams')
          .insert(generatedTeamNames.map(name => ({ name })))
          .select('id, name')

        if (createTeamsError || !createdTeams) {
          if (createTeamsError) console.error(createTeamsError)
          return showNotification('Unable to generate teams')
        }

        const teamIdByName = new Map(createdTeams.map(team => [team.name, team.id]))
        const generatedPlayers = Array.from({ length: safePlayerCount }, (_, index) => {
          const teamName = generatedTeamNames[index % safeTeamCount]

          return {
            name: `Player ${index + 1}`,
            team_id: teamIdByName.get(teamName)
          }
        })

        const { error: createPlayersError } = await supabase
          .from('players')
          .insert(generatedPlayers)

        if (createPlayersError) {
          console.error(createPlayersError)
          return showNotification('Teams were generated, but player creation failed')
        }

        await fetchTeams()
      } else {
        const generatedTeams = buildLocalRoster(safeTeamCount, safePlayerCount)
        localStorage.setItem('teams', JSON.stringify(generatedTeams))
        localStorage.setItem('shots', JSON.stringify([]))
        setTeams(generatedTeams)
      }

      setRecentlyDeletedPlayers([])
      setRestoreTeamByPlayerKey({})
      showNotification(`Generated ${safeTeamCount} teams and ${safePlayerCount} players`)
    } finally {
      setIsGenerating(false)
    }
  }

  const removePlayer = async (playerId, teamId) => {
    const sourceTeam = teams.find(teamItem => idsMatch(teamItem.id, teamId))
    const playerToRemove = sourceTeam?.players.find(player => idsMatch(player.id, playerId))
    if (!sourceTeam || !playerToRemove) return showNotification('Player not found')

    const deletedKey = `${Date.now()}-${playerToRemove.id}`
    let savedShots = []

    if (supabase) {
      const { data: playerShots, error: playerShotsError } = await supabase
        .from('shots')
        .select('round, zone, made, points')
        .eq('player_id', playerId)

      if (playerShotsError) {
        console.error(playerShotsError)
        return showNotification('Unable to save player scores before deleting')
      }

      savedShots = playerShots || []

      const { error } = await supabase.from('players').delete().eq('id', playerId)
      if (error) {
        console.error(error)
        return showNotification('Unable to remove player')
      }

      await fetchTeams()
    } else {
      const allShots = JSON.parse(localStorage.getItem('shots') || '[]')
      savedShots = allShots.filter(shot => idsMatch(shot.player_id, playerId))

      const updatedTeams = teams.map(teamItem => {
        if (idsMatch(teamItem.id, teamId)) {
          return { ...teamItem, players: teamItem.players.filter(player => !idsMatch(player.id, playerId)) }
        }
        return teamItem
      })

      const remainingShots = allShots.filter(shot => !idsMatch(shot.player_id, playerId))
      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      localStorage.setItem('shots', JSON.stringify(remainingShots))
      setTeams(updatedTeams)
    }

    setRecentlyDeletedPlayers(prev => [
      {
        deletedKey,
        name: playerToRemove.name,
        originalPlayerId: playerToRemove.id,
        originalTeamId: sourceTeam.id,
        originalTeamName: sourceTeam.name,
        savedShots
      },
      ...prev
    ].slice(0, 10))

    setRestoreTeamByPlayerKey(prev => ({
      ...prev,
      [deletedKey]: sourceTeam.id
    }))

    const savedShotCount = savedShots.length
    const shotLabel = savedShotCount === 1 ? 'shot' : 'shots'
    showNotification(`${playerToRemove.name} removed. ${savedShotCount} ${shotLabel} saved for restore.`)
  }

  const restorePlayer = async (deletedKey) => {
    const deletedPlayer = recentlyDeletedPlayers.find(player => player.deletedKey === deletedKey)
    if (!deletedPlayer) return

    const selectedTeamId = restoreTeamByPlayerKey[deletedKey]
    const fallbackTeamId = teams[0]?.id
    const targetTeamId = selectedTeamId ?? fallbackTeamId
    const targetTeam = teams.find(teamItem => idsMatch(teamItem.id, targetTeamId))
    const savedShots = Array.isArray(deletedPlayer.savedShots) ? deletedPlayer.savedShots : []

    if (!targetTeam) return showNotification('Choose a team before restoring')

    if (supabase) {
      const { data: restoredPlayer, error } = await supabase
        .from('players')
        .insert([{ name: deletedPlayer.name, team_id: targetTeam.id }])
        .select('id')
        .single()

      if (error || !restoredPlayer) {
        console.error(error)
        return showNotification('Unable to restore player')
      }

      if (savedShots.length > 0) {
        const restoredShots = savedShots
          .map(savedShot => toRestoredShotCore(savedShot, restoredPlayer.id))
          .filter(Boolean)

        if (restoredShots.length > 0) {
          const { error: restoreShotsError } = await supabase.from('shots').insert(restoredShots)

          if (restoreShotsError) {
            console.error(restoreShotsError)
            await supabase.from('players').delete().eq('id', restoredPlayer.id)
            return showNotification('Unable to restore player score history')
          }
        }
      }

      await fetchTeams()
    } else {
      let restoredPlayerId = deletedPlayer.originalPlayerId ?? Date.now()
      const playerIdAlreadyExists = teams.some(teamItem =>
        teamItem.players.some(player => idsMatch(player.id, restoredPlayerId))
      )

      if (playerIdAlreadyExists) {
        restoredPlayerId = Date.now()
      }

      const restoredPlayer = {
        id: restoredPlayerId,
        name: deletedPlayer.name
      }

      const updatedTeams = teams.map(teamItem => {
        if (idsMatch(teamItem.id, targetTeam.id)) {
          return { ...teamItem, players: [...teamItem.players, restoredPlayer] }
        }
        return teamItem
      })

      const existingShots = JSON.parse(localStorage.getItem('shots') || '[]')
      const shotIdBase = Date.now()
      const restoredShots = savedShots
        .map((savedShot, index) => toLocalRestoredShot(savedShot, restoredPlayerId, shotIdBase + index))
        .filter(Boolean)

      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      localStorage.setItem('shots', JSON.stringify([...existingShots, ...restoredShots]))
      setTeams(updatedTeams)
    }

    setRecentlyDeletedPlayers(prev => prev.filter(player => player.deletedKey !== deletedKey))
    setRestoreTeamByPlayerKey(prev => {
      const next = { ...prev }
      delete next[deletedKey]
      return next
    })

    const restoredShotCount = savedShots.length
    const shotLabel = restoredShotCount === 1 ? 'shot' : 'shots'
    const restoreMessage = restoredShotCount > 0
      ? `${deletedPlayer.name} restored to ${targetTeam.name} with ${restoredShotCount} ${shotLabel}.`
      : `${deletedPlayer.name} restored to ${targetTeam.name}`

    showNotification(restoreMessage)
  }

  const clearPlayerData = async (playerId, playerName) => {
    const shouldClearData = window.confirm(
      `Clear all scoring data for ${playerName}? This cannot be undone.`
    )

    if (!shouldClearData) return

    if (supabase) {
      const { error } = await supabase
        .from('shots')
        .delete()
        .eq('player_id', playerId)

      if (error) {
        console.error(error)
        return showNotification('Unable to clear player data')
      }
    } else {
      const allShots = JSON.parse(localStorage.getItem('shots') || '[]')
      const filteredShots = allShots.filter(shot => !idsMatch(shot.player_id, playerId))
      localStorage.setItem('shots', JSON.stringify(filteredShots))
    }

    showNotification(`All scoring data for ${playerName} has been cleared.`)
  }

  const movePlayer = async (playerId, fromTeamId, toTeamId) => {
    if (fromTeamId === toTeamId) return
    const fromTeam = teams.find(t => t.id === fromTeamId || t.id === Number(fromTeamId))
    const toTeam = teams.find(t => t.id === toTeamId || t.id === Number(toTeamId))
    if (!fromTeam || !toTeam) return showNotification('Team not found')

    if (supabase) {
      const { error } = await supabase.from('players').update({ team_id: toTeamId }).eq('id', playerId)
      if (error) return console.error(error)
      fetchTeams()
      return
    }

    const playerItem = fromTeam.players.find(p => p.id === playerId)
    if (!playerItem) return

    const updatedTeams = teams.map(teamItem => {
      if (teamItem.id === fromTeamId) {
        return { ...teamItem, players: teamItem.players.filter(player => player.id !== playerId) }
      }
      if (teamItem.id === toTeamId) {
        return { ...teamItem, players: [...teamItem.players, playerItem] }
      }
      return teamItem
    })

    localStorage.setItem('teams', JSON.stringify(updatedTeams))
    setTeams(updatedTeams)
  }

  const toggleMoveMenu = (playerId) => {
    setActiveMovePlayerId(prev => (prev === playerId ? null : playerId))
  }

  const handleMoveSelection = async (playerId, fromTeamId, toTeamId) => {
    await movePlayer(playerId, fromTeamId, toTeamId)
    setActiveMovePlayerId(null)
  }

  const removeTeam = async (teamId) => {
    if (supabase) {
      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      if (error) return console.error(error)
      fetchTeams()
      return
    }

    const updatedTeams = teams.filter(t => t.id !== teamId)
    localStorage.setItem('teams', JSON.stringify(updatedTeams))
    setTeams(updatedTeams)
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '100px' }}>
      <h1>Team Creation</h1>
      
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontWeight: '500',
          animation: 'slideDown 0.3s ease-out',
        }}>
          {notification}
          <button
            onClick={() => setNotification(null)}
            style={{
              marginLeft: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0',
              lineHeight: '1',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        input, select {
          padding: 0.7rem 1rem;
          font-size: 1rem;
          border: 1px solid rgba(79, 163, 255, 0.3);
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.05);
          color: #ffffff;
          transition: all 0.2s ease;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        
        input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        
        input:focus, select:focus {
          outline: none;
          border-color: #4fa3ff;
          background-color: rgba(79, 163, 255, 0.1);
          box-shadow: 0 0 0 3px rgba(79, 163, 255, 0.1);
        }
        
        select {
          cursor: pointer;
        }
        
        select option {
          background-color: #1a2f4f;
          color: #ffffff;
        }

        .start-btn-pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(229, 114, 0, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(229, 114, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(229, 114, 0, 0); }
        }
      `}</style>
      
      {/* Auto Generation Section */}
      <div style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)', marginBottom: '2rem' }}>
        <h2 style={{marginTop: 0, color: '#ffffff'}}>Auto Generate Teams & Players</h2>
        <p style={{ marginTop: 0, color: 'rgba(255, 255, 255, 0.8)' }}>
          Select how many teams and players you want, then generate balanced rosters automatically.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
          <label style={{ color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            Teams
            <select
              value={teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value))}
            >
              {Array.from({ length: 4 }, (_, index) => index + 1).map(count => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>

          <label style={{ color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            Total Players
            <select
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {Array.from({ length: 18 }, (_, index) => index + 1).map(count => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>

          <button
            onClick={generateTeamsAndPlayers}
            disabled={isGenerating}
            style={{padding: '0.7em 1.4em', fontSize: '0.95em', opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer'}}
          >
            {isGenerating ? 'Generating...' : 'Generate Teams'}
          </button>
        </div>

        <p style={{ marginBottom: 0, marginTop: '0.9rem', color: 'rgba(255, 255, 255, 0.75)' }}>
          Team size preview: {getBalancedRosterPreview().join(' / ')} players per team.
        </p>
      </div>
      
      {/* Recently Deleted Section */}
      <div style={{ padding: '2rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.15)' }}>
        {recentlyDeletedPlayers.length > 0 && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.25)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.7rem', color: '#ffffff' }}>Recently Deleted Players</h3>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {recentlyDeletedPlayers.map(deletedPlayer => (
                <div
                  key={deletedPlayer.deletedKey}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.65rem',
                    flexWrap: 'wrap',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(79, 163, 255, 0.2)'
                  }}
                >
                  <div>
                    <strong style={{ color: '#ffffff' }}>{deletedPlayer.name}</strong>
                    <p style={{ margin: '0.2rem 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.82rem' }}>
                      Removed from {deletedPlayer.originalTeamName}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <select
                      value={restoreTeamByPlayerKey[deletedPlayer.deletedKey] ?? ''}
                      onChange={(e) => {
                        setRestoreTeamByPlayerKey(prev => ({
                          ...prev,
                          [deletedPlayer.deletedKey]: Number(e.target.value)
                        }))
                      }}
                      style={{ width: 'auto', minWidth: '140px', fontSize: '0.9rem', padding: '0.35rem 0.55rem' }}
                    >
                      {teams.map(teamItem => (
                        <option key={teamItem.id} value={teamItem.id}>{teamItem.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => restorePlayer(deletedPlayer.deletedKey)}
                      disabled={teams.length === 0}
                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 style={{marginTop: 0, color: '#4fa3ff', marginBottom: '1.5rem'}}>Teams & Players</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {teams.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No teams yet. Create one to get started!</p>
          ) : (
            teams.map(team => (
              <div key={team.id} style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.12)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{marginTop: 0, marginBottom: 0, color: '#ffffff', fontSize: '1.3em'}}>{team.name}</h3>
                  <button onClick={() => removeTeam(team.id)} style={{ backgroundColor: '#ff4444' }}>Delete</button>
                </div>
                {team.players.length === 0 ? (
                  <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>No players yet</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {team.players.map(player => (
                      <li key={player.id} style={{ padding: '0.8rem', marginBottom: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', border: '1px solid rgba(79, 163, 255, 0.2)', color: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{player.name}</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button onClick={() => toggleMoveMenu(player.id)} style={{ fontSize: '0.8em' }}>Move</button>
                            <button onClick={() => removePlayer(player.id, team.id)} style={{ fontSize: '0.8em' }}>×</button>
                          </div>
                        </div>
                        {activeMovePlayerId === player.id && (
                          <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {teams.filter(dest => dest.id !== team.id).map(dest => (
                              <button key={dest.id} onClick={() => handleMoveSelection(player.id, team.id, dest.id)} style={{ fontSize: '0.75em' }}>{dest.name}</button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- START GAME ACTION BAR --- */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        width: '100%',
        padding: '25px',
        background: 'rgba(10, 14, 23, 0.98)',
        borderTop: '2px solid rgba(79, 163, 255, 0.3)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 -15px 35px rgba(0,0,0,0.6)',
        zIndex: 100
      }}>
        <button
          onClick={onStartGame}
          disabled={teams.length === 0}
          className={!isGameStarted && teams.length > 0 ? 'start-btn-pulse' : ''}
          style={{
            padding: '1.25rem 4rem',
            fontSize: '1.6rem',
            fontWeight: '900',
            backgroundColor: isGameStarted ? '#28a745' : '#E57200',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: teams.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            opacity: teams.length === 0 ? 0.5 : 1
          }}
        >
          {isGameStarted ? '✓ Game is Live' : 'Start Game for All Players'}
        </button>
      </div>

      {/* Spacing element so footer doesn't cover content */}
      <div style={{ height: '120px' }}></div>
    </div>
  );
}

export default TeamCreation
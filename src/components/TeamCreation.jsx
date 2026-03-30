import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function TeamCreation() {
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
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

  useEffect(() => {
    fetchTeams() // eslint-disable-line react-hooks/exhaustive-deps

    const handleUnload = () => {
      if (!supabase) {
        localStorage.removeItem('teams')
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [fetchTeams])

  const createTeam = async () => {
    const trimmedName = newTeamName.trim()
    if (!trimmedName) return showNotification('Team name cannot be empty')
    if (teams.length >= 4) return showNotification('Maximum 4 teams')
    const teamExists = teams.some(team => team.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (teamExists) return showNotification('Team name already exists')

    if (supabase) {
      const { error } = await supabase.from('teams').insert([{ name: trimmedName }])
      if (error) console.error(error)
      else {
        setNewTeamName('')
        fetchTeams()
      }
    } else {
      const newTeam = { id: Date.now(), name: trimmedName, players: [] }
      const updatedTeams = [...teams, newTeam]
      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      setTeams(updatedTeams)
      setNewTeamName('')
    }
  }

  const addPlayer = async () => {
    if (!selectedTeam) return showNotification('Select a team first')

    const team = teams.find(t => t.id === selectedTeam.id)
    if (!team) return showNotification('Selected team not found')

    const trimmedPlayerName = newPlayerName.trim()
    if (!trimmedPlayerName) return showNotification('Player name cannot be empty')

    if (team.players.length >= 4) return showNotification('Maximum 4 players per team')

    const playerExists = teams.some(teamItem =>
      teamItem.players.some(player => player.name.trim().toLowerCase() === trimmedPlayerName.toLowerCase())
    )
    if (playerExists) return showNotification('A player with that name already exists')

    if (supabase) {
      const { error } = await supabase.from('players').insert([{ name: trimmedPlayerName, team_id: selectedTeam.id }])
      if (error) console.error(error)
      else {
        setNewPlayerName('')
        fetchTeams()
      }
    } else {
      const updatedTeams = teams.map(teamItem => {
        if (teamItem.id === selectedTeam.id) {
          return { ...teamItem, players: [...teamItem.players, { id: Date.now(), name: trimmedPlayerName }] }
        }
        return teamItem
      })
      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      setTeams(updatedTeams)
      setSelectedTeam(updatedTeams.find(t => t.id === selectedTeam.id) || null)
      setNewPlayerName('')
    }
  }

  const removePlayer = async (playerId, teamId) => {
    if (supabase) {
      const { error } = await supabase.from('players').delete().eq('id', playerId)
      if (error) return console.error(error)
      fetchTeams()
      return
    }

    const updatedTeams = teams.map(teamItem => {
      if (teamItem.id === teamId) {
        return { ...teamItem, players: teamItem.players.filter(player => player.id !== playerId) }
      }
      return teamItem
    })
    localStorage.setItem('teams', JSON.stringify(updatedTeams))
    setTeams(updatedTeams)
    if (selectedTeam?.id === teamId) setSelectedTeam(updatedTeams.find(t => t.id === teamId) || null)
  }

  const movePlayer = async (playerId, fromTeamId, toTeamId) => {
    if (fromTeamId === toTeamId) return
    const fromTeam = teams.find(t => t.id === fromTeamId || t.id === Number(fromTeamId))
    const toTeam = teams.find(t => t.id === toTeamId || t.id === Number(toTeamId))
    if (!fromTeam || !toTeam) return showNotification('Team not found')

    if (toTeam.players.length >= 4) return showNotification('Destination team already has 4 players')

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
    setSelectedTeam(updatedTeams.find(t => t.id === selectedTeam?.id) || null)
  }

  const removeTeam = async (teamId) => {
    if (supabase) {
      // First delete all players in this team
      const team = teams.find(t => t.id === teamId)
      if (team && team.players) {
        for (const player of team.players) {
          await supabase.from('players').delete().eq('id', player.id)
        }
      }
      // Then delete the team
      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      if (error) return console.error(error)
      fetchTeams()
      return
    }

    const updatedTeams = teams.filter(t => t.id !== teamId)
    localStorage.setItem('teams', JSON.stringify(updatedTeams))
    setTeams(updatedTeams)
    if (selectedTeam?.id === teamId) setSelectedTeam(null)
  }

  return (
    <div>
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
      `}</style>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
        {teams.length < 4 && (
          <div style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
            <h2 style={{marginTop: 0, color: '#ffffff'}}>Create Team</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team Name" />
              <button onClick={createTeam} style={{padding: '0.7em 1.4em', fontSize: '0.95em'}}>Create Team</button>
            </div>
          </div>
        )}
        
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          <h2 style={{marginTop: 0, color: '#ffffff'}}>Add Player</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <select onChange={(e) => setSelectedTeam(teams.find(t => t.id == e.target.value))}>
              <option>Select Team</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player Name" />
            <button onClick={addPlayer} style={{padding: '0.7em 1.4em', fontSize: '0.95em'}}>Add Player</button>
          </div>
        </div>
      </div>
      
      <div style={{ padding: '2rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.15)' }}>
        <h2 style={{marginTop: 0, color: '#4fa3ff', marginBottom: '1.5rem'}}>Teams & Players</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {teams.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No teams yet. Create one to get started!</p>
          ) : (
            teams.map(team => (
              <div key={team.id} style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.12)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{marginTop: 0, marginBottom: 0, color: '#ffffff', fontSize: '1.3em'}}>{team.name}</h3>
                  <button 
                    onClick={() => removeTeam(team.id)} 
                    style={{ padding: '0.3em 0.6em', fontSize: '0.9em', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} 
                    title="Delete team"
                  >
                    Delete
                  </button>
                </div>
                {team.players.length === 0 ? (
                  <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>No players yet</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {team.players.map(player => (
                      <li key={player.id} style={{ padding: '0.8rem', marginBottom: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', border: '1px solid rgba(79, 163, 255, 0.2)', color: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{player.name}</span>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button onClick={() => removePlayer(player.id, team.id)} style={{ padding: '0.3em 0.6em', fontSize: '0.8em' }} title="Remove player">×</button>
                            <select
                              onChange={(e) => {
                                if (!e.target.value) return
                                movePlayer(player.id, team.id, Number(e.target.value))
                              }}
                              value=""
                              style={{ fontSize: '0.8em', padding: '0.3em 0.6em' }}
                              title="Move to another team"
                            >
                              <option value="">→</option>
                              {teams
                                .filter(dest => dest.id !== team.id)
                                .map(dest => (
                                  <option key={dest.id} value={dest.id}>{dest.name}</option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default TeamCreation
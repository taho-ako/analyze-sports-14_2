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
      `}</style>
      <div>
        <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team Name" />
        <button onClick={createTeam}>Create Team</button>
      </div>
      <div>
        <select onChange={(e) => setSelectedTeam(teams.find(t => t.id == e.target.value))}>
          <option>Select Team</option>
          {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player Name" />
        <button onClick={addPlayer}>Add Player</button>
      </div>
      <div>
        {teams.map(team => (
          <div key={team.id}>
            <h2>{team.name}</h2>
            <ul>
              {team.players.map(player => (
                <li key={player.id}>
                  {player.name}
                  <button onClick={() => removePlayer(player.id, team.id)} style={{ marginLeft: 8 }}>Remove</button>
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return
                      movePlayer(player.id, team.id, Number(e.target.value))
                    }}
                    value=""
                    style={{ marginLeft: 8 }}
                  >
                    <option value="">Move to...</option>
                    {teams
                      .filter(dest => dest.id !== team.id)
                      .map(dest => (
                        <option key={dest.id} value={dest.id}>{dest.name}</option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TeamCreation
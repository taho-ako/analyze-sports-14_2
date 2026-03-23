import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function TeamCreation() {
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')

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

  useEffect(() => {
    fetchTeams() // eslint-disable-line react-hooks/exhaustive-deps
  }, [fetchTeams])

  const createTeam = async () => {
    if (teams.length >= 4) return alert('Maximum 4 teams')
    if (supabase) {
      const { error } = await supabase.from('teams').insert([{ name: newTeamName }])
      if (error) console.error(error)
      else {
        setNewTeamName('')
        fetchTeams()
      }
    } else {
      const newTeam = { id: Date.now(), name: newTeamName, players: [] }
      const updatedTeams = [...teams, newTeam]
      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      setTeams(updatedTeams)
      setNewTeamName('')
    }
  }

  const addPlayer = async () => {
    if (!selectedTeam || selectedTeam.players.length >= 4) return alert('Maximum 4 players per team')
    if (supabase) {
      const { error } = await supabase.from('players').insert([{ name: newPlayerName, team_id: selectedTeam.id }])
      if (error) console.error(error)
      else {
        setNewPlayerName('')
        fetchTeams()
      }
    } else {
      const updatedTeams = teams.map(team => {
        if (team.id === selectedTeam.id) {
          return { ...team, players: [...team.players, { id: Date.now(), name: newPlayerName }] }
        }
        return team
      })
      localStorage.setItem('teams', JSON.stringify(updatedTeams))
      setTeams(updatedTeams)
      setNewPlayerName('')
    }
  }

  return (
    <div>
      <h1>Team Creation</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
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
              {team.players.map(player => <li key={player.id}>{player.name}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TeamCreation
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

function DataView() {
  const [playerStats, setPlayerStats] = useState([])
  const [teamStats, setTeamStats] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)

  const fetchData = useCallback(async () => {
    let playersData, teamsData
    if (supabase) {
      // Fetch players with shots
      const { data: pData, error: playersError } = await supabase
        .from('players')
        .select('*, teams(name), shots(*)')
      if (playersError) console.error(playersError)
      playersData = pData

      // Fetch teams
      const { data: tData, error: teamsError } = await supabase.from('teams').select('*')
      if (teamsError) console.error(teamsError)
      teamsData = tData
    } else {
      teamsData = JSON.parse(localStorage.getItem('teams') || '[]')
      const shots = JSON.parse(localStorage.getItem('shots') || '[]')
      playersData = teamsData.flatMap(team => 
        team.players.map(player => ({
          ...player,
          teams: { name: team.name },
          shots: shots.filter(shot => shot.player_id === player.id)
        }))
      )
    }

    // Calculate stats
    if (playersData && teamsData) {
      setTeams(teamsData)
      calculateStats(playersData, teamsData)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const calculateStats = (playersData, teamsData) => {
    // Player stats
    const pStats = playersData.map(player => {
      const shots = player.shots
      const totalShots = shots.length
      const totalMade = shots.filter(s => s.made).length
      const totalPoints = shots.reduce((sum, s) => sum + s.points, 0)
      const accuracy = totalShots > 0 ? (totalMade / totalShots * 100).toFixed(1) : 0

      const zoneStats = {}
      for (let z = 1; z <= 6; z++) {
        const zoneShots = shots.filter(s => s.zone === z)
        zoneStats[z] = {
          made: zoneShots.filter(s => s.made).length,
          total: zoneShots.length,
          accuracy: zoneShots.length > 0 ? (zoneShots.filter(s => s.made).length / zoneShots.length * 100).toFixed(1) : 0
        }
      }

      return {
        name: player.name,
        team: player.teams.name,
        totalShots,
        totalMade,
        totalPoints,
        accuracy,
        zoneStats
      }
    })
    setPlayerStats(pStats)

    // Team stats
    const tStats = teamsData.map(team => {
      const teamPlayers = pStats.filter(p => p.team === team.name)
      const totalShots = teamPlayers.reduce((sum, p) => sum + p.totalShots, 0)
      const totalMade = teamPlayers.reduce((sum, p) => sum + p.totalMade, 0)
      const totalPoints = teamPlayers.reduce((sum, p) => sum + p.totalPoints, 0)
      const accuracy = totalShots > 0 ? (totalMade / totalShots * 100).toFixed(1) : 0

      return {
        name: team.name,
        totalShots,
        totalMade,
        totalPoints,
        accuracy
      }
    })
    setTeamStats(tStats)
  }

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#faaac2', '#a4de6c']

  // Get stacked bar chart data showing points by zone for each player
  const getZonePointsData = (stats) => {
    return stats.map(player => {
      const data = { name: player.name }
      for (let z = 1; z <= 6; z++) {
        const zoneMade = player.zoneStats[z]?.made || 0
        const points = z === 1 ? zoneMade * 1 : z <= 3 ? zoneMade * 2 : zoneMade * 3
        data[`Zone ${z}`] = points
      }
      return data
    })
  }

  // Get point contributions data (for pie chart)
  const getPointContributions = (stats) => {
    return stats.map(player => ({
      name: player.name,
      value: player.totalPoints
    })).filter(item => item.value > 0)
  }

  // Get zone contributions data (for pie chart)
  const getZoneContributions = (stats) => {
    const zonePoints = { 'Zone 1': 0, 'Zone 2': 0, 'Zone 3': 0, 'Zone 4': 0, 'Zone 5': 0, 'Zone 6': 0 }
    stats.forEach(player => {
      for (let z = 1; z <= 6; z++) {
        const zoneMade = player.zoneStats[z]?.made || 0
        const points = z === 1 ? zoneMade * 1 : z <= 3 ? zoneMade * 2 : zoneMade * 3
        zonePoints[`Zone ${z}`] += points
      }
    })
    return Object.entries(zonePoints)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
  }

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', backgroundColor: 'transparent' }}>
      <h1>Data View</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      
      {/* Team Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          <h2 style={{marginTop: 0, color: '#ffffff'}}>Select Team</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <button 
              onClick={() => setSelectedTeam(null)}
              style={{
                padding: '0.7em 1.4em',
                backgroundColor: selectedTeam === null ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: selectedTeam === null ? '600' : '500'
              }}
            >
              All Teams
            </button>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                style={{
                  padding: '0.7em 1.4em',
                  backgroundColor: selectedTeam?.id === team.id ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: selectedTeam?.id === team.id ? '600' : '500'
                }}
              >
                {team.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {playerStats.length === 0 ? (
        <p>No players have been added yet. Add teams and players to see stats here.</p>
      ) : (
        <>
          {/* Filter data based on team selection */}
          {(() => {
            const filteredPlayerStats = selectedTeam 
              ? playerStats.filter(p => p.team === selectedTeam.name)
              : playerStats;
            const finalTeamStats = selectedTeam
              ? teamStats.filter(t => t.name === selectedTeam.name)
              : teamStats;

            return (
              <>
                <h2>Player Stats Table</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      {!selectedTeam && <th>Team</th>}
                      <th>Total Shots</th>
                      <th>Shots Made</th>
                      <th>Accuracy</th>
                      <th>Total Points</th>
                      {Array.from({length: 6}, (_, i) => <th key={i+1}>Zone {i+1} Made/Total (Acc%)</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayerStats.map(player => (
                      <tr key={player.name}>
                        <td>{player.name}</td>
                        {!selectedTeam && <td>{player.team}</td>}
                        <td>{player.totalShots}</td>
                        <td>{player.totalMade}</td>
                        <td>{player.accuracy}%</td>
                        <td>{player.totalPoints}</td>
                        {Array.from({length: 6}, (_, i) => {
                          const z = i + 1
                          const stat = player.zoneStats[z]
                          return <td key={z}>{stat.made}/{stat.total} ({stat.accuracy}%)</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h2>{selectedTeam ? selectedTeam.name : 'Team'} Stats Table</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Total Shots</th>
                      <th>Shots Made</th>
                      <th>Accuracy</th>
                      <th>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalTeamStats.map(team => (
                      <tr key={team.name}>
                        <td>{team.name}</td>
                        <td>{team.totalShots}</td>
                        <td>{team.totalMade}</td>
                        <td>{team.accuracy}%</td>
                        <td>{team.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </>
      )}

      {/* Visualizations */}
      {playerStats.length > 0 && (
        <>
          {(() => {
            const filteredPlayerStats = selectedTeam 
              ? playerStats.filter(p => p.team === selectedTeam.name)
              : playerStats;

            const zonePointsData = getZonePointsData(filteredPlayerStats)
            const pointContributions = getPointContributions(filteredPlayerStats)
            const zoneContributions = getZoneContributions(filteredPlayerStats)

            return (
              <>
                {/* 1. Stacked Bar Chart - Zone Points */}
                <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
                  <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Points by Zone</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={zonePointsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis dataKey="name" stroke="#ffffff" />
                      <YAxis stroke="#ffffff" />
                      <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                      <Legend />
                      <Bar dataKey="Zone 1" stackId="a" fill="#ff7c7c" />
                      <Bar dataKey="Zone 2" stackId="a" fill="#ffc658" />
                      <Bar dataKey="Zone 3" stackId="a" fill="#82ca9d" />
                      <Bar dataKey="Zone 4" stackId="a" fill="#8884d8" />
                      <Bar dataKey="Zone 5" stackId="a" fill="#d084d0" />
                      <Bar dataKey="Zone 6" stackId="a" fill="#8dd1e1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 2. Pie Chart - Point Contributions */}
                <div style={{ marginTop: '2rem', padding: '2rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
                  <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Point Contributions</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={pointContributions}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pointContributions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 3. Pie Chart - Zone Contributions */}
                <div style={{ marginTop: '2rem', padding: '2rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
                  <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Zone Contributions</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={zoneContributions}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#ff7c7c" />
                        <Cell fill="#ffc658" />
                        <Cell fill="#82ca9d" />
                        <Cell fill="#8884d8" />
                        <Cell fill="#d084d0" />
                        <Cell fill="#8dd1e1" />
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  )
}

export default DataView
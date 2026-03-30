import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

function DataView() {
  const [playerStats, setPlayerStats] = useState([])
  const [teamStats, setTeamStats] = useState([])
  const [zoneDistribution, setZoneDistribution] = useState([])

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

    // Zone distribution - percentage of all shots per zone, plus made/total
    const allShots = playersData.flatMap(p => p.shots)
    const totalAllShots = allShots.length
    const zDist = []
    for (let z = 1; z <= 6; z++) {
      const zoneShotsArr = allShots.filter(s => s.zone === z)
      const zoneShots = zoneShotsArr.length
      const made = zoneShotsArr.filter(s => s.made).length
      const accuracy = zoneShots > 0 ? (made / zoneShots * 100) : 0
      zDist.push({
        zone: `Zone ${z}`,
        accuracy: parseFloat(accuracy.toFixed(1)),
        made,
        total: zoneShots
      })
    }
    setZoneDistribution(zDist)
  }

  return (
    <div>
      <h1>Data View</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      <h2>Player Stats</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>Total Shots</th>
            <th>Shots Made</th>
            <th>Accuracy</th>
            <th>Total Points</th>
            {Array.from({length: 6}, (_, i) => <th key={i+1}>Zone {i+1} Made/Total (Acc%)</th>)}
          </tr>
        </thead>
        <tbody>
          {playerStats.map(player => (
            <tr key={player.name}>
              <td>{player.name}</td>
              <td>{player.team}</td>
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

      <h2>Team Stats</h2>
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
          {teamStats.map(team => (
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

      <h2>Team Comparison</h2>
      <BarChart width={600} height={300} data={teamStats}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="totalPoints" fill="#8884d8" />
        <Bar dataKey="accuracy" fill="#82ca9d" />
      </BarChart>

      <h2>Shot Distribution by Zone</h2>
      <BarChart width={800} height={400} data={zoneDistribution}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="zone" />
        <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const { accuracy, made, total } = payload[0].payload
              return (
                <div style={{ background: '#fff', border: '1px solid #ccc', padding: 10, color: '#000' }}>
                  <div><strong>{label}</strong></div>
                  <div>Accuracy: {accuracy}%</div>
                  <div>Shots Made / Shots Taken: ({made}/{total})</div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend />
        <Bar dataKey="accuracy" fill="#ffc658" name="Accuracy" />
      </BarChart>

      <h2>Player Comparison</h2>
      <BarChart width={800} height={400} data={playerStats}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="totalPoints" fill="#8884d8" />
        <Bar dataKey="accuracy" fill="#82ca9d" />
      </BarChart>
    </div>
  )
}

export default DataView
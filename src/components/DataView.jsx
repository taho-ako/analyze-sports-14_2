import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, LineChart, Line,
  ScatterChart, Scatter,
  ComposedChart
} from 'recharts'

function DataView() {
  const [playerStats, setPlayerStats] = useState([])
  const [teamStats, setTeamStats] = useState([])

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
  }

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#faaac2', '#a4de6c']

  // Transform data for radar chart
  const getRadarData = (player) => {
    if (player.totalShots === 0) return []
    return [
      { subject: 'Accuracy', A: parseFloat(player.accuracy), fullMark: 100 },
      { subject: 'Total Points', A: Math.min(player.totalPoints, 100), fullMark: 100 },
      { subject: 'Shots Made', A: Math.min(player.totalMade * 10, 100), fullMark: 100 },
      { subject: 'Zone 1', A: parseFloat(player.zoneStats[1]?.accuracy || 0), fullMark: 100 },
      { subject: 'Zone 2', A: parseFloat(player.zoneStats[2]?.accuracy || 0), fullMark: 100 },
      { subject: 'Zone 3', A: parseFloat(player.zoneStats[3]?.accuracy || 0), fullMark: 100 }
    ]
  }

  // Transform data for scatter plot
  const getScatterData = () => {
    return playerStats.map(p => ({
      name: p.name,
      x: p.totalShots,
      y: parseFloat(p.accuracy),
      z: p.totalPoints
    }))
  }

  // Transform data for zone heatmap
  const getZoneHeatmapData = () => {
    const zones = [1, 2, 3, 4, 5, 6]
    return zones.map(zone => {
      const data = { zone: `Zone ${zone}` }
      playerStats.forEach(player => {
        data[player.name] = parseFloat(player.zoneStats[zone]?.accuracy || 0)
      })
      return data
    })
  }

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', backgroundColor: 'transparent' }}>
      <h1>Data View</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      {playerStats.length === 0 ? (
        <p>No players have been added yet. Add teams and players to see stats here.</p>
      ) : (
        <>
          <h2>Player Stats Table</h2>
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

      <h2>Team Stats Table</h2>
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

      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* 1. Team Comparison - Bar Chart */}
        <div>
          <h2>Team Points Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalPoints" fill="#8884d8" name="Total Points" />
              <Bar dataKey="accuracy" fill="#82ca9d" name="Accuracy %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Pie Chart - Makes vs Misses */}
        <div>
          <h2>Overall Makes vs Misses</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Made', value: playerStats.reduce((sum, p) => sum + p.totalMade, 0) },
                  { name: 'Missed', value: playerStats.reduce((sum, p) => sum + (p.totalShots - p.totalMade), 0) }
                ]}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#82ca9d" />
                <Cell fill="#ff7c7c" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Scatter Plot - Volume vs Accuracy */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Shot Volume vs Accuracy</h2>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name="Total Shots" />
            <YAxis dataKey="y" name="Accuracy %" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return <div style={{backgroundColor: 'white', padding: '5px', border: '1px solid #ccc'}}>
                    {data.name}<br/>Shots: {data.x}<br/>Accuracy: {data.y}%<br/>Points: {data.z}
                  </div>;
                }
                return null;
              }} 
            />
            <Scatter name="Players" data={getScatterData()} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Zone Accuracy Heatmap (Stacked Bar) */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Zone Accuracy by Player (Stacked)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={getZoneHeatmapData()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" />
            <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {playerStats.map((player, idx) => (
              <Bar key={player.name} dataKey={player.name} stackId="a" fill={COLORS[idx % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Custom Court Visualization - Zone Heatmap */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Shooting Zones Performance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', maxWidth: '600px' }}>
          {Array.from({length: 6}, (_, i) => {
            const zone = i + 1
            const avgAccuracy = playerStats.length > 0 
              ? playerStats.reduce((sum, p) => sum + parseFloat(p.zoneStats[zone]?.accuracy || 0), 0) / playerStats.length
              : 0
            const getColor = (acc) => {
              if (acc >= 75) return '#22c55e'
              if (acc >= 50) return '#eab308'
              if (acc >= 25) return '#f97316'
              return '#ef4444'
            }
            return (
              <div
                key={zone}
                style={{
                  backgroundColor: getColor(avgAccuracy),
                  padding: '2rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  minHeight: '100px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div style={{fontSize: '24px', marginBottom: '0.5rem'}}>Zone {zone}</div>
                <div style={{fontSize: '18px'}}>{avgAccuracy.toFixed(1)}% Accuracy</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 6. Individual Player Radar Charts */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Individual Player Performance Radar</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
          {playerStats.map((player, idx) => (
            player.totalShots > 0 && (
              <div key={player.name}>
                <h3>{player.name}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={getRadarData(player)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name={player.name} dataKey="A" stroke={COLORS[idx % COLORS.length]} fill={COLORS[idx % COLORS.length]} fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )
          ))}
        </div>
      </div>

      {/* 7. Player Comparison - Multi-metric Bar Chart */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Player Comparison - All Metrics</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={playerStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalPoints" fill="#8884d8" name="Total Points" />
            <Bar dataKey="accuracy" fill="#82ca9d" name="Accuracy %" />
            <Bar dataKey="totalShots" fill="#ffc658" name="Total Shots" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 8. Team Comparison Panels */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Team Comparison Panels</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {teamStats.map((team, idx) => (
            <div key={team.name} style={{
              border: '2px solid #ccc',
              borderRadius: '8px',
              padding: '1.5rem',
              backgroundColor: '#f9f9f9'
            }}>
              <h3 style={{margin: '0 0 1rem 0', color: COLORS[idx % COLORS.length]}}>{team.name}</h3>
              <div style={{fontSize: '14px', lineHeight: '1.8'}}>
                <div><strong>Total Shots:</strong> {team.totalShots}</div>
                <div><strong>Shots Made:</strong> {team.totalMade}</div>
                <div><strong>Accuracy:</strong> {team.accuracy}%</div>
                <div><strong>Total Points:</strong> {team.totalPoints}</div>
                <div style={{marginTop: '1rem', fontSize: '12px', color: '#666'}}>
                  <strong>Team Players:</strong> {playerStats.filter(p => p.team === team.name).length}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 9. Line Chart - Zone Progression */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Zone Performance Trend</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={getZoneHeatmapData()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" />
            <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {playerStats.map((player, idx) => (
              <Line 
                key={player.name} 
                type="monotone" 
                dataKey={player.name} 
                stroke={COLORS[idx % COLORS.length]}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )}
    </div>
  )
}

export default DataView
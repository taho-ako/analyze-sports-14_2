import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function Scoring() {
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [zoneStats, setZoneStats] = useState({})

  const fetchPlayers = useCallback(async () => {
    if (supabase) {
      const { data, error } = await supabase.from('players').select('*, teams(name)')
      if (error) console.error(error)
      else setPlayers(data)
    } else {
      const teams = JSON.parse(localStorage.getItem('teams') || '[]')
      const allPlayers = teams.flatMap(team => team.players.map(player => ({ ...player, teams: { name: team.name } })))
      setPlayers(allPlayers)
    }
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  const fetchZoneStats = useCallback(async () => {
    if (!selectedPlayer) return
    if (supabase) {
      const { data, error } = await supabase
        .from('shots')
        .select('*')
        .eq('player_id', selectedPlayer.id)
      if (error) console.error(error)
      else {
        const stats = {}
        data.forEach(shot => {
          if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
          stats[shot.zone].total++
          if (shot.made) stats[shot.zone].made++
        })
        setZoneStats(stats)
      }
    } else {
      const shots = JSON.parse(localStorage.getItem('shots') || '[]').filter(shot => shot.player_id === selectedPlayer.id)
      const stats = {}
      shots.forEach(shot => {
        if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
        stats[shot.zone].total++
        if (shot.made) stats[shot.zone].made++
      })
      setZoneStats(stats)
    }
  }, [selectedPlayer])

  useEffect(() => {
    fetchZoneStats()
  }, [fetchZoneStats])

  const recordShot = async (made) => {
    if (!selectedPlayer || !selectedZone) return
    const points = selectedZone === 1 ? 1 : selectedZone <= 3 ? 2 : 3
    const pointChange = made ? points : -points
    if (supabase) {
      const { error } = await supabase.from('shots').insert([{
        player_id: selectedPlayer.id,
        zone: selectedZone,
        made,
        points: pointChange
      }])
      if (error) console.error(error)
      else {
        setSelectedZone(null)
        fetchZoneStats()
      }
    } else {
      const newShot = {
        id: Date.now(),
        player_id: selectedPlayer.id,
        zone: selectedZone,
        made,
        points: pointChange
      }
      const shots = JSON.parse(localStorage.getItem('shots') || '[]')
      shots.push(newShot)
      localStorage.setItem('shots', JSON.stringify(shots))
      setSelectedZone(null)
      fetchZoneStats()
    }
  }

  const getZoneColor = (zone) => {
    const stat = zoneStats[zone]
    if (!stat || stat.total === 0) return 'gray'
    const accuracy = stat.made / stat.total
    if (accuracy > 0.7) return 'green'
    if (accuracy > 0.4) return 'yellow'
    return 'red'
  }

  const zones = [1,2,3,4,5,6]

  return (
    <div>
      <h1>Scoring</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      <select onChange={(e) => setSelectedPlayer(players.find(p => p.id == e.target.value))}>
        <option>Select Player</option>
        {players.map(player => <option key={player.id} value={player.id}>{player.name} ({player.teams.name})</option>)}
      </select>
      {selectedPlayer && (
        <div>
          <h2>Heat Map</h2>
          <div className="heatmap">
            {zones.map(zone => (
              <button
                key={zone}
                className="zone"
                style={{ backgroundColor: getZoneColor(zone) }}
                onClick={() => setSelectedZone(zone)}
              >
                Zone {zone}
              </button>
            ))}
          </div>
          {selectedZone && (
            <div>
              <p>Selected Zone: {selectedZone}</p>
              <button onClick={() => recordShot(true)}>Make</button>
              <button onClick={() => recordShot(false)}>Miss</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Scoring
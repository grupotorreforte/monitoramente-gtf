import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  Headphones,
  ListChecks,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  VolumeX
} from 'lucide-react'
import StreamCard from './components/StreamCard'
import { allStreamIds, streams } from './data/streams'
import { apiUrl } from './lib/apiBaseUrl'
import { emptyNowPlaying, fetchNowPlaying } from './lib/nowPlaying'
import { watchStreams } from './lib/watchStream'

const METADATA_REFRESH_MS = 60000
const WAVEFORM_LEVEL_UPDATE_MS = 90
const STREAM_CHANNEL = 'stream'
const FM_CHANNEL = 'fm'

function createProbeState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        status: 'idle',
        detail: 'Aguardando primeira verificação.',
        checkedAt: null,
        latencyMs: null
      }
    ])
  )
}

function createFmProbeState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        status: stream.fmMonitorUrl ? 'idle' : 'unconfigured',
        detail: stream.fmMonitorUrl ? 'Aguardando primeira verificação do FM.' : 'Link de monitoramento FM pendente.',
        checkedAt: null,
        latencyMs: null
      }
    ])
  )
}

function createNowPlayingState() {
  return Object.fromEntries(streams.map((stream) => [stream.id, { ...emptyNowPlaying }]))
}

function createAudioState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        isPlaying: false,
        isMuted: true,
        volume: 1
      }
    ])
  )
}

function createFmAudioState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        isPlaying: false,
        isMuted: true,
        volume: 1
      }
    ])
  )
}

function getStreamLabel(stream) {
  return `${stream.name} · ${stream.city} - ${stream.state}`
}

function isMetadataOffline(stream, nowPlaying) {
  return stream.metadataOfflineMeansDown && nowPlaying?.title?.trim().toLowerCase() === ''
}

function buildPlaybackUrl(stream, cacheBust = Date.now()) {
  const params = new URLSearchParams({
    url: stream.streamUrl,
    _: String(cacheBust)
  })

  if (stream.fallbackUrl) {
    params.set('fallbackUrl', stream.fallbackUrl)
  }

  return apiUrl(`/api/audio?${params.toString()}`)
}

function buildFmPlaybackUrl(stream, cacheBust = Date.now()) {
  if (!stream.fmMonitorUrl) return null

  const params = new URLSearchParams({
    url: stream.fmMonitorUrl,
    _: String(cacheBust)
  })

  if (stream.fmFallbackUrl) {
    params.set('fallbackUrl', stream.fmFallbackUrl)
  }

  return apiUrl(`/api/audio?${params.toString()}`)
}

function getDirectPlaybackUrl(stream) {
  return stream.streamUrl
}

function getDirectFmPlaybackUrl(stream) {
  return stream.fmMonitorUrl
}

function getAudioKey(streamId, channel = STREAM_CHANNEL) {
  return channel === FM_CHANNEL ? `${streamId}:fm` : streamId
}

export default function App() {
  const audioRefs = useRef({})
  const audioContextRef = useRef(null)
  const sourceNodesRef = useRef({})
  const gainNodesRef = useRef({})
  const previousStatusesRef = useRef({})
  const lastWaveformUpdateRef = useRef({})
  const [probeStates, setProbeStates] = useState(createProbeState)
  const [fmProbeStates, setFmProbeStates] = useState(createFmProbeState)
  const [nowPlayingStates, setNowPlayingStates] = useState(createNowPlayingState)
  const [audioStates, setAudioStates] = useState(createAudioState)
  const [fmAudioStates, setFmAudioStates] = useState(createFmAudioState)
  const [meterNodes, setMeterNodes] = useState({})
  const [waveformPeaks, setWaveformPeaks] = useState(() =>
    Object.fromEntries(
      streams.flatMap((stream) => [
        [getAudioKey(stream.id, STREAM_CHANNEL), new Array(96).fill(0.03)],
        [getAudioKey(stream.id, FM_CHANNEL), new Array(96).fill(0.03)]
      ])
    )
  )
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [columns, setColumns] = useState(4)
  const [selectedStreamIds, setSelectedStreamIds] = useState(allStreamIds)
  const [singleStreamId, setSingleStreamId] = useState(allStreamIds[0])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [hasStartedAudioMonitoring, setHasStartedAudioMonitoring] = useState(false)

  const selectedIdSet = useMemo(() => new Set(selectedStreamIds), [selectedStreamIds])
  const monitoredStreams = useMemo(
    () => streams.filter((stream) => selectedIdSet.has(stream.id)),
    [selectedIdSet]
  )
  const allSelected = selectedStreamIds.length === allStreamIds.length
  const onlineCount = monitoredStreams.filter(
    (stream) => probeStates[stream.id]?.status === 'online' && !isMetadataOffline(stream, nowPlayingStates[stream.id])
  ).length
  const unavailableCount = monitoredStreams.filter((stream) =>
    ['offline', 'timeout'].includes(probeStates[stream.id]?.status) || isMetadataOffline(stream, nowPlayingStates[stream.id])
  ).length
  const activeFilterLabel =
    allSelected
      ? 'Todas as rádios'
      : selectedStreamIds.length === 1
        ? streams.find((stream) => stream.id === selectedStreamIds[0])?.name
        : `${selectedStreamIds.length} rádios selecionadas`

  const getEffectiveMute = (streamId, audioState = audioStates[streamId]) =>
    Boolean(audioState?.isMuted)

  useEffect(() => {
    streams.forEach((stream) => {
      const audio = new Audio(buildPlaybackUrl(stream))
      audio.preload = 'none'
      audio.crossOrigin = 'anonymous'
      audio.dataset.playbackMode = 'proxy'

      const handlePlaybackError = () => {
        if (audio.dataset.playbackMode !== 'proxy') return

        audio.dataset.playbackMode = 'direct'
        audio.src = getDirectPlaybackUrl(stream)
        audio.load()
      }

      audio.addEventListener('error', handlePlaybackError)
      audioRefs.current[stream.id] = audio

      if (stream.fmMonitorUrl) {
        const fmAudio = new Audio(buildFmPlaybackUrl(stream))
        const fmAudioKey = getAudioKey(stream.id, FM_CHANNEL)
        fmAudio.preload = 'none'
        fmAudio.crossOrigin = 'anonymous'
        fmAudio.dataset.playbackMode = 'proxy'

        const handleFmPlaybackError = () => {
          if (fmAudio.dataset.playbackMode !== 'proxy' || !stream.fmMonitorUrl) return

          fmAudio.dataset.playbackMode = 'direct'
          fmAudio.src = getDirectFmPlaybackUrl(stream)
          fmAudio.load()
        }

        fmAudio.addEventListener('error', handleFmPlaybackError)
        audioRefs.current[fmAudioKey] = fmAudio
      }
    })

    return () => {
      streams.forEach((stream) => {
        const streamKeys = [stream.id, getAudioKey(stream.id, FM_CHANNEL)]

        streamKeys.forEach((audioKey) => {
          const audio = audioRefs.current[audioKey]
          if (!audio) return

          audio.pause()
          audio.removeAttribute('data-playback-mode')
          audio.removeAttribute('src')
          audio.load()
        })
      })
    }
  }, [])

  const ensureAudioGraph = (streamId, channel = STREAM_CHANNEL, audioState = audioStates[streamId]) => {
    const audioKey = getAudioKey(streamId, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return null

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {})
    }

    if (!sourceNodesRef.current[audioKey]) {
      const sourceNode = audioContextRef.current.createMediaElementSource(audio)
      const gainNode = audioContextRef.current.createGain()

      audio.muted = false
      audio.volume = 1
      gainNode.gain.value = getEffectiveMute(streamId, audioState) ? 0 : audioState?.volume ?? 1
      sourceNode.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      sourceNodesRef.current[audioKey] = sourceNode
      gainNodesRef.current[audioKey] = gainNode

      setMeterNodes((state) => ({
        ...state,
        [audioKey]: {
          audioContext: audioContextRef.current,
          sourceNode
        }
      }))
    }

    return sourceNodesRef.current[audioKey]
  }

  const setOutputGain = (streamId, volume, isMuted, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(streamId, channel)
    const audioContext = audioContextRef.current
    const gainNode = gainNodesRef.current[audioKey]

    if (!gainNode || !audioContext) return

    gainNode.gain.setTargetAtTime(isMuted ? 0 : volume, audioContext.currentTime, 0.015)
  }

  const prepareAudio = (stream, channel = STREAM_CHANNEL, audioState = audioStates[stream.id]) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return false

    try {
      ensureAudioGraph(stream.id, channel, audioState)
      return true
    } catch {
      return false
    }
  }

  const playPreparedAudio = async (stream, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return false

    try {
      await audio.play()
      return true
    } catch {
      if (audio.dataset.playbackMode === 'proxy') {
        const directUrl = channel === FM_CHANNEL ? getDirectFmPlaybackUrl(stream) : getDirectPlaybackUrl(stream)
        if (!directUrl) return false

        audio.dataset.playbackMode = 'direct'
        audio.src = directUrl
        audio.load()

        try {
          await audio.play()
          return true
        } catch {
          return false
        }
      }

      return false
    }
  }

  const startStreams = async (streamsToStart, channel = STREAM_CHANNEL, state = audioStates) => {
    const playableStreams = channel === FM_CHANNEL
      ? streamsToStart.filter((stream) => stream.fmMonitorUrl)
      : streamsToStart
    const preparedStreams = playableStreams.filter((stream) => prepareAudio(stream, channel, state[stream.id]))

    const results = await Promise.allSettled(preparedStreams.map((stream) => playPreparedAudio(stream, channel)))
    const playedStreamIds = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        playedStreamIds.push(preparedStreams[index].id)
      }
    })

    return playedStreamIds
  }

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([audioKey, audio]) => {
      const streamId = audioKey.replace(/:fm$/, '')
      if (selectedIdSet.has(streamId)) return

      audio.pause()
    })

    setAudioStates((state) =>
      Object.fromEntries(
        Object.entries(state).map(([streamId, value]) => [
          streamId,
          {
            ...value,
            isPlaying: selectedIdSet.has(streamId) ? value.isPlaying : false
          }
        ])
      )
    )

    setFmAudioStates((state) =>
      Object.fromEntries(
        Object.entries(state).map(([streamId, value]) => [
          streamId,
          {
            ...value,
            isPlaying: selectedIdSet.has(streamId) ? value.isPlaying : false
          }
        ])
      )
    )

  }, [selectedIdSet])

  useEffect(() => {
    let cancelled = false

    async function refreshMetadata() {
      if (monitoredStreams.length === 0) {
        return
      }

      const results = await Promise.all(
        monitoredStreams.map(async (stream) => {
          const nowPlaying = await fetchNowPlaying(stream.metadataUrl)
          return [stream.id, nowPlaying]
        })
      )

      if (cancelled) return

      setNowPlayingStates((current) => {
        const nextState = { ...current }
        results.forEach(([streamId, nowPlaying]) => {
          nextState[streamId] = nowPlaying
        })
        return nextState
      })
    }

    refreshMetadata()
    const intervalId = window.setInterval(refreshMetadata, METADATA_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [monitoredStreams])

  useEffect(() => {
    if (monitoredStreams.length === 0) {
      setIsMonitoring(false)
      return () => {}
    }

    setIsMonitoring(true)

    const handleStatus = (probe) => {
      const stream = streams.find((item) => item.id === probe.id)
      if (!stream) return

      setProbeStates((state) => ({
        ...state,
        [stream.id]: probe
      }))

      const previousStatus = previousStatusesRef.current[stream.id]
      previousStatusesRef.current[stream.id] = probe.status

      if (previousStatus === 'online' && ['offline', 'timeout'].includes(probe.status)) {
        const alert = {
          id: `${stream.id}-${Date.now()}`,
          streamName: stream.name,
          detail: probe.detail,
          time: new Date(probe.checkedAt).toLocaleTimeString('pt-BR')
        }

        setAlerts((current) => [alert, ...current].slice(0, 5))

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`${stream.name} caiu`, {
            body: probe.detail
          })
        }
      }
    }

    const cleanupWatcher = watchStreams({
      streams: monitoredStreams,
      onStatus: handleStatus,
      onError: (probe) => {
        monitoredStreams.forEach((stream) => {
          handleStatus({ id: stream.id, ...probe })
        })
      }
    })

    return () => {
      cleanupWatcher()
      setIsMonitoring(false)
    }
  }, [monitoredStreams])

  useEffect(() => {
    const fmStreamsToWatch = monitoredStreams
      .filter((stream) => stream.fmMonitorUrl)
      .map((stream) => ({
        id: stream.id,
        streamUrl: stream.fmMonitorUrl,
        fallbackUrl: stream.fmFallbackUrl
      }))

    setFmProbeStates((state) => {
      const nextState = { ...state }
      monitoredStreams.forEach((stream) => {
        if (!stream.fmMonitorUrl) {
          nextState[stream.id] = {
            ...nextState[stream.id],
            status: 'unconfigured',
            detail: 'Link de monitoramento FM pendente.',
            checkedAt: null,
            latencyMs: null
          }
        }
      })
      return nextState
    })

    if (fmStreamsToWatch.length === 0) {
      return () => {}
    }

    const handleFmStatus = (probe) => {
      setFmProbeStates((state) => ({
        ...state,
        [probe.id]: probe
      }))
    }

    const cleanupWatcher = watchStreams({
      streams: fmStreamsToWatch,
      onStatus: handleFmStatus,
      onError: (probe) => {
        fmStreamsToWatch.forEach((stream) => {
          handleFmStatus({ id: stream.id, ...probe })
        })
      }
    })

    return () => {
      cleanupWatcher()
    }
  }, [monitoredStreams])

  const handleToggleMute = (streamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return

    const nextMuted = !audioStates[streamId]?.isMuted
    audio.muted = false
    audio.volume = 1
    setOutputGain(streamId, audioStates[streamId]?.volume ?? 1, getEffectiveMute(streamId, { ...audioStates[streamId], isMuted: nextMuted }))

    setAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        isMuted: nextMuted
      }
    }))
  }

  const handleToggleFmMute = (streamId) => {
    const audioKey = getAudioKey(streamId, FM_CHANNEL)
    const audio = audioRefs.current[audioKey]
    if (!audio) return

    const nextMuted = !fmAudioStates[streamId]?.isMuted
    audio.muted = false
    audio.volume = 1
    setOutputGain(streamId, fmAudioStates[streamId]?.volume ?? 1, getEffectiveMute(streamId, { ...fmAudioStates[streamId], isMuted: nextMuted }), FM_CHANNEL)

    setFmAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        isMuted: nextMuted
      }
    }))
  }

  const handleVolumeChange = (streamId, nextVolume) => {
    const audio = audioRefs.current[streamId]
    if (audio) {
      audio.volume = 1
      audio.muted = false
    }

    setOutputGain(streamId, nextVolume, getEffectiveMute(streamId, { ...audioStates[streamId], volume: nextVolume, isMuted: nextVolume === 0 }))

    setAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        volume: nextVolume,
        isMuted: nextVolume === 0 ? true : state[streamId].isMuted && nextVolume === 0
      }
    }))
  }

  const handleFmVolumeChange = (streamId, nextVolume) => {
    const audioKey = getAudioKey(streamId, FM_CHANNEL)
    const audio = audioRefs.current[audioKey]
    if (audio) {
      audio.volume = 1
      audio.muted = false
    }

    setOutputGain(streamId, nextVolume, getEffectiveMute(streamId, { ...fmAudioStates[streamId], volume: nextVolume, isMuted: nextVolume === 0 }), FM_CHANNEL)

    setFmAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        volume: nextVolume,
        isMuted: nextVolume === 0 ? true : state[streamId].isMuted && nextVolume === 0
      }
    }))
  }

  const handleReconnect = async (streamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return

    const stream = streams.find((item) => item.id === streamId)
    if (!stream) return

    audio.pause()
    audio.dataset.playbackMode = 'proxy'
    audio.src = buildPlaybackUrl(stream)
    audio.load()

    setProbeStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        status: 'checking',
        detail: 'Reconectando stream...'
      }
    }))

    const nowPlaying = await fetchNowPlaying(stream.metadataUrl)

    setNowPlayingStates((state) => ({
      ...state,
      [streamId]: nowPlaying
    }))
  }

  const handleFmReconnect = async (streamId) => {
    const audioKey = getAudioKey(streamId, FM_CHANNEL)
    const audio = audioRefs.current[audioKey]
    if (!audio) return

    const stream = streams.find((item) => item.id === streamId)
    if (!stream?.fmMonitorUrl) return

    audio.pause()
    audio.dataset.playbackMode = 'proxy'
    audio.src = buildFmPlaybackUrl(stream)
    audio.load()

    setFmProbeStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        status: 'checking',
        detail: 'Reconectando FM...'
      }
    }))

    const playedStreamIds = await startStreams([stream], FM_CHANNEL, fmAudioStates)

    setFmAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        isPlaying: playedStreamIds.includes(streamId)
      }
    }))
  }

  const handleStartMonitoring = async () => {
    setHasStartedAudioMonitoring(true)

    const playedStreamIds = await startStreams(monitoredStreams)
    const playedFmStreamIds = await startStreams(monitoredStreams, FM_CHANNEL, fmAudioStates)
    const playedIdSet = new Set(playedStreamIds)
    const playedFmIdSet = new Set(playedFmStreamIds)

    setAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isPlaying: playedIdSet.has(stream.id)
          }
        ])
      )
    }))

    setFmAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isPlaying: playedFmIdSet.has(stream.id)
          }
        ])
      )
    }))
  }

  const handleMuteAll = () => {
    monitoredStreams.forEach((stream) => {
      const audio = audioRefs.current[stream.id]
      if (audio) {
        audio.volume = 1
        audio.muted = false
      }
      setOutputGain(stream.id, audioStates[stream.id]?.volume ?? 1, true)

      const fmAudioKey = getAudioKey(stream.id, FM_CHANNEL)
      const fmAudio = audioRefs.current[fmAudioKey]
      if (fmAudio) {
        fmAudio.volume = 1
        fmAudio.muted = false
      }
      setOutputGain(stream.id, fmAudioStates[stream.id]?.volume ?? 1, true, FM_CHANNEL)
    })

    setAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isMuted: true
          }
        ])
      )
    }))

    setFmAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isMuted: true
          }
        ])
      )
    }))
  }

  const handleReconnectAll = async () => {
    for (const stream of monitoredStreams) {
      await handleReconnect(stream.id)
      if (stream.fmMonitorUrl) {
        await handleFmReconnect(stream.id)
      }
    }
  }

  const handleToggleStreamSelection = (streamId) => {
    setSelectedStreamIds((current) => {
      const nextSet = new Set(current)

      if (nextSet.has(streamId)) {
        nextSet.delete(streamId)
      } else {
        nextSet.add(streamId)
      }

      return streams.filter((stream) => nextSet.has(stream.id)).map((stream) => stream.id)
    })
  }

  const handleMonitorSingle = () => {
    if (!singleStreamId) return
    setSelectedStreamIds([singleStreamId])
    setHasStartedAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleMonitorAll = () => {
    setSelectedStreamIds(allStreamIds)
    setHasStartedAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleCycleColumns = () => {
    setColumns((current) => (current === 4 ? 1 : current + 1))
  }

  const handleMeterLevelsForKey = useCallback((waveformKey, levels) => {
    const [left = 0, right = 0] = levels ?? []
    const nextPeak = Math.max(0.03, Math.min(1, ((left + right) / 2) * 8))
    const now = performance.now()

    if (now - (lastWaveformUpdateRef.current[waveformKey] ?? 0) < WAVEFORM_LEVEL_UPDATE_MS) {
      return
    }

    lastWaveformUpdateRef.current[waveformKey] = now

    setWaveformPeaks((state) => {
      const current = state[waveformKey] ?? new Array(96).fill(0.03)
      return {
        ...state,
        [waveformKey]: [...current.slice(1), nextPeak]
      }
    })
  }, [])

  const handleMeterLevels = useCallback((streamId, levels) => {
    handleMeterLevelsForKey(getAudioKey(streamId, STREAM_CHANNEL), levels)
  }, [handleMeterLevelsForKey])

  const handleFmMeterLevels = useCallback((streamId, levels) => {
    handleMeterLevelsForKey(getAudioKey(streamId, FM_CHANNEL), levels)
  }, [handleMeterLevelsForKey])

  return (
    <main className="app-shell">
      <section className="control-bar" aria-label="Controles de monitoramento">
        <button type="button" className="control-button" onClick={handleStartMonitoring} disabled={monitoredStreams.length === 0}>
          <Headphones size={18} aria-hidden="true" />
          {hasStartedAudioMonitoring ? 'Monitoramento iniciado' : 'Iniciar monitoramento'}
        </button>
        <button type="button" className="control-button is-mute" onClick={handleMuteAll} disabled={monitoredStreams.length === 0}>
          <VolumeX size={18} aria-hidden="true" />
          Mutar todos
        </button>
        <button type="button" className="control-button is-primary" onClick={handleReconnectAll} disabled={monitoredStreams.length === 0}>
          <RefreshCw size={18} aria-hidden="true" />
          Reconectar todos
        </button>
        <button type="button" className="control-button" onClick={handleCycleColumns}>
          <Monitor size={18} aria-hidden="true" />
          Alterar modo ({columns} coluna{columns > 1 ? 's' : ''})
        </button>
        <div className="column-switcher" aria-label="Quantidade de colunas">
          {[1, 2, 3, 4].map((columnCount) => (
            <button
              key={columnCount}
              type="button"
              className={`column-button ${columns === columnCount ? 'is-active' : ''}`}
              onClick={() => setColumns(columnCount)}
              title={`Exibir em ${columnCount} coluna${columnCount > 1 ? 's' : ''}`}
            >
              {columnCount}
            </button>
          ))}
        </div>

        <div className="toolbar-spacer" />

        <div className="single-picker">
          <select value={singleStreamId} onChange={(event) => setSingleStreamId(event.target.value)}>
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {getStreamLabel(stream)}
              </option>
            ))}
          </select>
          <button type="button" className="control-button" onClick={handleMonitorSingle} title="Monitorar somente esta rádio">
            <Search size={18} aria-hidden="true" />
            Monitorar uma
          </button>
        </div>

        <div className="filter-menu">
          <button
            type="button"
            className="control-button"
            onClick={() => setIsFilterOpen((current) => !current)}
            aria-expanded={isFilterOpen}
            title="Escolher rádios específicas"
          >
            <ListChecks size={18} aria-hidden="true" />
            Rádios específicas
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {isFilterOpen && (
            <div className="filter-popover">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      handleMonitorAll()
                    } else {
                      setSelectedStreamIds([])
                    }
                  }}
                />
                <span>Todas as rádios</span>
              </label>

              <div className="check-list">
                {streams.map((stream) => (
                  <label key={stream.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(stream.id)}
                      onChange={() => handleToggleStreamSelection(stream.id)}
                    />
                    <span>{getStreamLabel(stream)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <p className="source-note"></p>

     {/*  <div className="monitoring-context">
        <span>{activeFilterLabel}</span>
        <span>{onlineCount} online</span>
        <span>{unavailableCount} offline</span>
        <span>{isMonitoring ? 'Monitoramento contínuo ativo' : 'Monitoramento parado'}</span>
      </div> */}

      {alerts.length > 0 && (
        <section className="alerts-panel" aria-label="Alertas de queda">
          {alerts.map((alert) => (
            <article key={alert.id} className="alert-item">
              <strong>{alert.streamName} caiu</strong>
              <span>{alert.time}</span>
              <p>{alert.detail}</p>
              <button type="button" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}>
                Fechar
              </button>
            </article>
          ))}
        </section>
      )}

      {monitoredStreams.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhuma rádio selecionada</h2>
          <button type="button" className="control-button is-primary" onClick={handleMonitorAll}>
            <RotateCcw size={18} aria-hidden="true" />
            Monitorar todas
          </button>
        </section>
      ) : (
        <section className="streams-grid" style={{ '--grid-columns': columns }}>
          {monitoredStreams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              probe={probeStates[stream.id]}
              fmProbe={fmProbeStates[stream.id]}
              nowPlaying={nowPlayingStates[stream.id]}
              audioState={audioStates[stream.id]}
              fmAudioState={fmAudioStates[stream.id]}
              audioContext={meterNodes[getAudioKey(stream.id, STREAM_CHANNEL)]?.audioContext ?? null}
              sourceNode={meterNodes[getAudioKey(stream.id, STREAM_CHANNEL)]?.sourceNode ?? null}
              fmAudioContext={meterNodes[getAudioKey(stream.id, FM_CHANNEL)]?.audioContext ?? null}
              fmSourceNode={meterNodes[getAudioKey(stream.id, FM_CHANNEL)]?.sourceNode ?? null}
              waveformPeaks={waveformPeaks[getAudioKey(stream.id, STREAM_CHANNEL)]}
              fmWaveformPeaks={waveformPeaks[getAudioKey(stream.id, FM_CHANNEL)]}
              isMeterActive={hasStartedAudioMonitoring}
              onMeterLevels={handleMeterLevels}
              onFmMeterLevels={handleFmMeterLevels}
              onToggleMute={handleToggleMute}
              onToggleFmMute={handleToggleFmMute}
              onVolumeChange={handleVolumeChange}
              onFmVolumeChange={handleFmVolumeChange}
              onReconnect={handleReconnect}
              onFmReconnect={handleFmReconnect}
            />
          ))}
        </section>
      )}
    </main>
  )
}

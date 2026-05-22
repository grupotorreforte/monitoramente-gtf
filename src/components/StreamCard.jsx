import { Radio, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import AudioMeterReact from './AudioMeterReact'

function StatusDot({ status, muted }) {
  return (
    <span className={`status-dot status-${status} ${muted ? 'is-muted' : ''}`}>
      {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
    </span>
  )
}

function AudioMeter({ active, audioContext, sourceNode, onLevels }) {
  return (
    <div className="vu-wrap" aria-label="Medidor L R">
      <AudioMeterReact
        active={active}
        audioContext={audioContext}
        sourceNode={sourceNode}
        onLevels={onLevels}
      />
    </div>
  )
}

function Fader({ volume, onVolumeChange }) {
  const volumePercent = Math.round(volume * 100)

  return (
    <div className="fader">
      <span className="fader-value">{volumePercent}%</span>
      <input
        className="fader-input"
        type="range"
        min="0"
        max="100"
        value={volumePercent}
        aria-label="Volume"
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
      />
    </div>
  )
}

function Waveform({ active, peaks }) {
  const safePeaks = peaks?.length ? peaks : new Array(96).fill(0.03)

  return (
    <div className={`waveform ${active ? 'is-live' : 'is-down'}`} aria-label="Waveform de áudio em tempo real">
      {safePeaks.map((peak, index) => (
        <span
          key={index}
          className="waveform-bar"
          style={{ transform: `scaleY(${Math.max(0.05, Math.min(1, peak))})` }}
        />
      ))}
    </div>
  )
}

function MonitorRow({ label, status, detail }) {
  const normalizedStatus = status ?? 'idle'

  return (
    <div className={`monitor-row monitor-${normalizedStatus}`}>
      <span className="monitor-label">
        <Radio size={13} aria-hidden="true" />
        {label}
      </span>
      <strong>{normalizedStatus === 'unconfigured' ? 'Pendente' : normalizedStatus}</strong>
      <span>{detail}</span>
    </div>
  )
}

export default function StreamCard({
  stream,
  probe,
  fmProbe,
  nowPlaying,
  audioState,
  audioContext,
  sourceNode,
  waveformPeaks,
  isMeterActive,
  onMeterLevels,
  onToggleMute,
  onVolumeChange,
  onReconnect
}) {
  const isMetadataOffline = stream.metadataOfflineMeansDown && nowPlaying.title?.trim().toLowerCase() === 'station offline'
  const isOnline = probe.status === 'online' && !isMetadataOffline
  const isOffline = ['offline', 'timeout'].includes(probe.status) || isMetadataOffline
  const isAudioAnalyzing = isMeterActive && (audioState.isPlaying || isOnline)
  const location = stream.city === 'Não informado' ? stream.state : `${stream.city} - ${stream.state}`
  const title = nowPlaying.title && !isMetadataOffline ? nowPlaying.title : isMetadataOffline ? '' : `${stream.frequency} - ${stream.name}`

  return (
    <article className={`stream-card stream-${isOffline ? 'offline' : probe.status}`}>
      <div className="meter-column">
      <AudioMeter
        active={isAudioAnalyzing}
        audioContext={audioContext}
        sourceNode={sourceNode}
        onLevels={(levels) => onMeterLevels(stream.id, levels)}
      />
      <Fader volume={audioState.volume} onVolumeChange={(volume) => onVolumeChange(stream.id, volume)} />
      </div>

      <div className="stream-body">
        <header className="stream-title-row">
          <StatusDot status={isOffline ? 'offline' : probe.status} muted={audioState.isMuted} />
          <h2>{stream.name}</h2>
          <strong>{stream.frequency}</strong>
        </header>

        {/* <div className="stream-subtitle">
            <Music2 size={16} aria-hidden="true" />
            <span>{title}</span>
        </div> */}

        <Waveform active={isAudioAnalyzing} peaks={waveformPeaks} />

        <div className="monitor-stack">
          <MonitorRow label="STREAMING" status={probe.status} detail={probe.detail} />
          <MonitorRow label="FM" status={fmProbe?.status} detail={fmProbe?.detail} />
        </div>

        <footer className="stream-footer">
          <span className={isOffline ? 'state-offline' : 'state-online'}>
            {isOffline ? 'Desconectado.' : isOnline ? 'Tocando' : 'Verificando'}
          </span>
          <span>{location}</span>
        </footer>
      </div>

      <div className="card-actions">
        <button type="button" className="card-action-button is-reconnect" onClick={() => onReconnect(stream.id)}>
          <RefreshCw size={17} aria-hidden="true" />
          Reconectar
        </button>
        <button type="button" className="card-action-button is-mute" onClick={() => onToggleMute(stream.id)}>
          {audioState.isMuted ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          {audioState.isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </article>
  )
}
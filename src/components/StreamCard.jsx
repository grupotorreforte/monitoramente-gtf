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
  const hasModulation = active && safePeaks.some((peak) => peak > 0.08)
  const isAlert = !hasModulation

  return (
    <div className={`waveform ${active ? 'is-live' : 'is-down'} ${isAlert ? 'is-alert' : ''}`} aria-label="Waveform de áudio em tempo real">
      {safePeaks.map((peak, index) => (
        <span
          key={index}
          className="waveform-bar"
          style={{ transform: `scaleY(${Math.max(0.05, Math.min(1, peak))})` }}
        />
      ))}
      {isAlert && <strong className="waveform-alert">SEM MODULAÇÃO</strong>}
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

function AudioBlock({
  label,
  status,
  detail,
  active,
  unavailable,
  audioState,
  audioContext,
  sourceNode,
  waveformPeaks,
  onMeterLevels,
  onToggleMute,
  onVolumeChange,
  onReconnect
}) {
  return (
    <section className={`audio-block ${unavailable ? 'is-unavailable' : ''}`}>
      <div className="meter-column">
        <AudioMeter
          active={active}
          audioContext={audioContext}
          sourceNode={sourceNode}
          onLevels={onMeterLevels}
        />
        <Fader volume={audioState.volume} onVolumeChange={onVolumeChange} />
      </div>

      <div className="audio-block-body">
        <div className="audio-block-heading">
          <MonitorRow label={label} status={status} detail={detail} />
        </div>
        <Waveform active={active && !unavailable} peaks={waveformPeaks} />
      </div>

      <div className="card-actions audio-block-actions">
        <button type="button" className="card-action-button is-reconnect" onClick={onReconnect} disabled={unavailable}>
          <RefreshCw size={17} aria-hidden="true" />
          Reconectar
        </button>
        <button type="button" className="card-action-button is-mute" onClick={onToggleMute} disabled={unavailable}>
          {audioState.isMuted ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          {audioState.isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </section>
  )
}

export default function StreamCard({
  stream,
  probe,
  fmProbe,
  nowPlaying,
  audioState,
  fmAudioState,
  audioContext,
  sourceNode,
  fmAudioContext,
  fmSourceNode,
  waveformPeaks,
  fmWaveformPeaks,
  isMeterActive,
  onMeterLevels,
  onFmMeterLevels,
  onToggleMute,
  onToggleFmMute,
  onVolumeChange,
  onFmVolumeChange,
  onReconnect,
  onFmReconnect
}) {
  const isMetadataOffline = stream.metadataOfflineMeansDown && nowPlaying.title?.trim().toLowerCase() === 'station offline'
  const isOnline = probe.status === 'online' && !isMetadataOffline
  const isOffline = ['offline', 'timeout'].includes(probe.status) || isMetadataOffline
  const isStreamingAnalyzing = isMeterActive && (audioState.isPlaying || isOnline)
  const isFmOnline = fmProbe?.status === 'online'
  const isFmUnavailable = !stream.fmMonitorUrl
  const isFmAnalyzing = isMeterActive && !isFmUnavailable && (fmAudioState.isPlaying || isFmOnline)
  const location = stream.city === 'Não informado' ? stream.state : `${stream.city} - ${stream.state}`
  const title = nowPlaying.title && !isMetadataOffline ? nowPlaying.title : isMetadataOffline ? '' : `${stream.frequency} - ${stream.name}`

  return (
    <article className={`stream-card stream-${isOffline ? 'offline' : probe.status}`}>
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

        <div className="audio-block-stack">
          <AudioBlock
            label="STREAMING"
            status={probe.status}
            detail={probe.detail}
            active={isStreamingAnalyzing}
            unavailable={false}
            audioState={audioState}
            audioContext={audioContext}
            sourceNode={sourceNode}
            waveformPeaks={waveformPeaks}
            onMeterLevels={(levels) => onMeterLevels(stream.id, levels)}
            onToggleMute={() => onToggleMute(stream.id)}
            onVolumeChange={(volume) => onVolumeChange(stream.id, volume)}
            onReconnect={() => onReconnect(stream.id)}
          />
          <AudioBlock
            label="FM"
            status={fmProbe?.status}
            detail={fmProbe?.detail}
            active={isFmAnalyzing}
            unavailable={isFmUnavailable}
            audioState={fmAudioState}
            audioContext={fmAudioContext}
            sourceNode={fmSourceNode}
            waveformPeaks={fmWaveformPeaks}
            onMeterLevels={(levels) => onFmMeterLevels(stream.id, levels)}
            onToggleMute={() => onToggleFmMute(stream.id)}
            onVolumeChange={(volume) => onFmVolumeChange(stream.id, volume)}
            onReconnect={() => onFmReconnect(stream.id)}
          />
        </div>

        <footer className="stream-footer">
          <span className={isOffline ? 'state-offline' : 'state-online'}>
            {isOffline ? 'Desconectado.' : isOnline ? 'Tocando' : 'Verificando'}
          </span>
          <span>{location}</span>
        </footer>
      </div>

    </article>
  )
}
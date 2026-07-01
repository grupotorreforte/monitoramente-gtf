const FM_INTERNAL_BASE_URL = 'https://192.168.70.253:8873'
const FM_INTERNAL_HTTP_BASE_URL = 'http://192.168.70.253:8870'
const FM_EXTERNAL_BASE_URL = 'https://streaming.grupogtf.com.br:8873'

function buildRelayUrl(path, baseUrl) {
  return `${baseUrl}/${path}`
}

function buildRelayPair(path) {
  return {
    streamUrl: buildRelayUrl(path, FM_INTERNAL_BASE_URL),
    fallbackUrl: buildRelayUrl(path, FM_EXTERNAL_BASE_URL),
    fallbackUrls: [buildRelayUrl(path, FM_INTERNAL_HTTP_BASE_URL)]
  }
}

function buildFmRelayPair(path) {
  return {
    fmMonitorUrl: buildRelayUrl(path, FM_INTERNAL_BASE_URL),
    fmFallbackUrl: buildRelayUrl(path, FM_EXTERNAL_BASE_URL),
    fmFallbackUrls: [buildRelayUrl(path, FM_INTERNAL_HTTP_BASE_URL)]
  }
}

function buildStreamRelayFallbacks(path) {
  return {
    fallbackUrls: [
      buildRelayUrl(path, FM_INTERNAL_HTTP_BASE_URL),
      buildRelayUrl(path, FM_EXTERNAL_BASE_URL)
    ]
  }
}

function buildSoundstream({
  id,
  name,
  city,
  frequency,
  host,
  slug,
  port,
  aliases = [],
  metadataOfflineMeansDown = false,
  streamUrl,
  fallbackUrl,
  fallbackUrls = [],
  metadataUrl,
  fmMonitorUrl = null,
  fmFallbackUrl = null,
  fmFallbackUrls = []
}) {
  return {
    id,
    name,
    city,
    state: 'MG',
    frequency,
    provider: 'Soundstream',
    protocol: 'Icecast2',
    slug,
    streamUrl: streamUrl ?? `https://${host}/listen/${slug}/live`,
    publicUrl: `https://${host}/public/${slug}`,
    metadataUrl: metadataUrl === undefined ? `https://${host}/api/nowplaying/${slug}` : metadataUrl,
    fallbackUrl: fallbackUrl === undefined ? `http://${host}:${port}/live` : fallbackUrl,
    fallbackUrls,
    fmMonitorUrl,
    fmFallbackUrl,
    fmFallbackUrls,
    aliases,
    metadataOfflineMeansDown
  }
}

function buildSrvstm({
  id,
  name,
  city,
  state = 'MG',
  frequency,
  streamUrl,
  fallbackUrl = null,
  fallbackUrls = [],
  fmMonitorUrl = null,
  fmFallbackUrl = null,
  fmFallbackUrls = []
}) {
  return {
    id,
    name,
    city,
    state,
    frequency,
    provider: 'Srvstm',
    protocol: 'HTTP Audio',
    slug: id,
    streamUrl,
    publicUrl: streamUrl,
    metadataUrl: null,
    fallbackUrl,
    fallbackUrls,
    fmMonitorUrl,
    fmFallbackUrl,
    fmFallbackUrls,
    aliases: [],
    metadataOfflineMeansDown: false
  }
}
export const streams = [
    buildSrvstm({
    id: '88-fm-sede-belo-horizonte',
    name: 'Rádio 88 FM - SEDE',
    city: 'Volta Redonda',
    state: 'RJ',
    frequency: '88,7 MHz',
    streamUrl: 'https://stm39.srvstm.com:9776/stream',
    ...buildStreamRelayFallbacks('88fm'),
    ...buildFmRelayPair('radiofm_88fm'),
    
  }),
  buildSrvstm({
    id: 'maravilha-fm-sede-belo-horizonte',
    name: '89 Maravilha FM - SEDE',
    city: 'Belo Horizonte',
    frequency: '89,1 MHz',
    streamUrl: 'https://stm19.srvstm.com:7080/stream',
    ...buildStreamRelayFallbacks('89fm'),
    ...buildFmRelayPair('radiofm_89fm'),
  }),
  buildSoundstream({
    id: 'maravilha-fm-cambui',
    name: 'Maravilha FM Cambuí',
    city: 'Cambuí',
    frequency: 'Afiliada',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmcambui',
    port: 8040,
    ...buildStreamRelayFallbacks('Cambui'),
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
    metadataOfflineMeansDown: true
  }),
  buildSoundstream({
    id: 'maravilha-fm-barbacena',
    name: 'Maravilha FM Barbacena',
    city: 'Barbacena',
    frequency: '89,3 MHz',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmbarbacena',
    ...buildStreamRelayFallbacks('barbacena'),
    ...buildFmRelayPair('radiofm_barbacena'),
    port: 8020
  }),
    buildSoundstream({
    id: 'maravilha-fm-governador-valadares',
    name: 'Maravilha FM Governador Valadares',
    city: 'Governador Valadares',
    frequency: '106,5 MHz',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmgovernadorvaladares',
    streamUrl: 'https://srv2.soundstream.com.br/listen/maravilhagvaladares/live',
    ...buildStreamRelayFallbacks('governadorvaladares'),
    ...buildFmRelayPair('radiofm_governadorvaladares'),
    port: 8070
  }),
  buildSoundstream({
    id: 'maravilha-fm-ipatinga',
    name: 'Maravilha FM Ipatinga',
    city: 'Ipatinga',
    frequency: '89,5 FM',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmipatinga',
    streamUrl: 'https://srv2.soundstream.com.br/listen/maravilhafmipatinga/live',
    ...buildStreamRelayFallbacks('ipatinga'),
    ...buildFmRelayPair('radiofm_ipatinga'),
    port: 8030
  }),
  buildSoundstream({
    id: 'maravilha-fm-juiz-de-fora',
    name: 'Maravilha FM Juiz de Fora',
    city: 'Juiz de Fora',
    frequency: '89,7 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmjf',
    port: 8030,
    ...buildStreamRelayFallbacks('juizdefora'),
    ...buildFmRelayPair('radiofm_juizdefora'),
    streamUrl: 'https://srv.soundstream.com.br:8030/live',
    fallbackUrl: "https://srv.soundstream.com.br:8030/live",
    metadataUrl: null
  }),
  buildSoundstream({
    id: 'maravilha-fm-joao-pinheiro',
    name: 'Maravilha FM João Pinheiro',
    city: 'João Pinheiro',
    frequency: '96,3 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafm',
    port: 8180,
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafm/live',
    ...buildStreamRelayFallbacks('joaopinheiro'),
    ...buildFmRelayPair('radiofm_joaopinheiro'),
    aliases: ['Rádio Maravilha FM']
  }),
  buildSoundstream({
    id: 'maravilha-fm-teofilo-otoni',
    name: 'Maravilha FM Teófilo Otoni',
    city: 'Teófilo Otoni',
    frequency: '89,7 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhateofilootoni',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhateofilootoni/live',
    ...buildStreamRelayFallbacks('teofilo_otoni'),
    ...buildFmRelayPair('radiofm_teofilootoni'),
    port: 8240
  }),
  buildSoundstream({
    id: 'maravilha-fm-campos-gerais',
    name: 'Maravilha FM Campos Gerais',
    city: 'Campos Gerais',
    frequency: '97,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhacamposgerais',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhacamposgerais/live',
    ...buildStreamRelayFallbacks('camposgerais'),
    ...buildFmRelayPair('radiofm_camposgerais'),
    port: 8170
  }),
  buildSoundstream({
    id: 'maravilha-fm-uba',
    name: 'Maravilha FM Ubá',
    city: 'Ubá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmuba',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmuba/live',
    ...buildStreamRelayFallbacks('uba'),
    ...buildFmRelayPair('radiofm_uba'),
    port: 8040
  }),
  buildSoundstream({
    id: 'maravilha-fm-montes-claros',
    name: 'Maravilha FM Montes Claros',
    city: 'Montes Claros',
    frequency: '89,5 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmmontesclaros',
    ...buildStreamRelayFallbacks('montesclaros'),
    ...buildFmRelayPair('radiofm_montesclaros'),
    port: 8020
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberlandia',
    name: 'Maravilha FM Uberlândia',
    city: 'Uberlândia',
    frequency: '89,7 FM',
    streamUrl: 'https://stm6.srvstm.com:7076/stream',
    ...buildStreamRelayFallbacks('uberlandia'),
    ...buildFmRelayPair('radiofm_uberlandia')
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberaba',
    name: 'Maravilha FM Uberaba',
    city: 'Uberaba',
    frequency: '89,3 FM',
    streamUrl: 'https://stm6.srvstm.com:7006/stream',
    ...buildStreamRelayFallbacks('uberaba'),
    ...buildFmRelayPair('radiofm_uberaba')
  }),
  buildSoundstream({
    id: 'maravilha-fm-leopoldina',
    name: 'Maravilha FM Leopoldina',
    city: 'Leopoldina',
    frequency: '89,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmleopoldina',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmleopoldina/live',
    ...buildStreamRelayFallbacks('leopoldina'),
    ...buildFmRelayPair('radiofm_leopoldina'),
    port: 8270
  }),
  buildSoundstream({
    id: 'maravilha-fm-araxa',
    name: 'Maravilha FM Araxá',
    city: 'Araxá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmaraxa',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmaraxa/live',
    ...buildStreamRelayFallbacks('araxa'),
    ...buildFmRelayPair('radiofm_araxa'),
    port: 8290
  }),
  buildSrvstm({
    id: 'maravilha-fm-varginha',
    name: 'Maravilha FM Varginha',
    city: 'Varginha',
    frequency: 'Afiliada',
    ...buildRelayPair('varginha'),
    ...buildFmRelayPair('radiofm_varginha')
  }),
  buildSrvstm({
    id: 'maravilha-fm-pouso-alegre',
    name: 'Maravilha FM Pouso Alegre',
    city: 'Pouso Alegre',
    frequency: 'Afiliada',
    ...buildRelayPair('pousoalegre'),
    ...buildFmRelayPair('radiofm_pousoalegre')
  }),
  buildSrvstm({
    id: 'maravilha-fm-diamantina',
    name: 'Maravilha FM Diamantina',
    city: 'Diamantina',
    frequency: 'Afiliada',
    ...buildRelayPair('diamantina'),
    ...buildFmRelayPair('radiofm_diamantina')
  })
]
export const allStreamIds = streams.map((stream) => stream.id)

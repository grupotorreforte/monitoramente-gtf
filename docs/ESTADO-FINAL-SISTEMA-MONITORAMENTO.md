# Estado Final do Sistema de Monitoramento

## Visao Geral

O `Servico_Monitoramento` e uma aplicacao React/Vite com backend Node local e funcoes serverless para Vercel. O painel monitora radios em dois canais por emissora:

- `STREAMING`: link publico/principal de audio da radio.
- `FM`: retorno de monitoramento vindo do servidor Dell da Radio 88 FM.

O objetivo operacional e comparar se o streaming publico esta online e se o retorno FM tambem esta chegando, com medidores visuais, waveform, volume, mute e reconexao local por card.

## Componentes Principais

### Frontend

- `src/App.jsx`: orquestra estado global, filtros, monitoramento, players, WebAudio e callbacks dos cards.
- `src/components/StreamCard.jsx`: renderiza cada radio com blocos `STREAMING` e `FM`.
- `src/components/AudioMeterReact.jsx`: faz leitura de audio pelo WebAudio e alimenta o VU meter.
- `src/styles.css`: layout visual, grid, cards, barras, controles e responsividade.
- `src/data/streams.js`: catalogo principal de radios monitoradas.

### Backend Local

- `server/index.js`: servidor Node para desenvolvimento/execucao standalone.
- Porta padrao local: `8787`.
- Endpoints principais: `/api/audio`, `/api/watch-many`, `/api/probe`, `/api/now-playing`.

### Backend Vercel

- `api/*.js`: funcoes serverless equivalentes para publicacao na Vercel.
- `vercel.json`: configura build Vite, pasta `dist` e rewrites.

## Modelo de Dados Atual

O catalogo principal esta em:

```text
src/data/streams.js
```

Cada radio possui os campos:

```js
{
  id: 'identificador-unico',
  name: 'Nome exibido',
  city: 'Cidade',
  state: 'MG',
  frequency: '89,1 MHz',
  provider: 'Soundstream | Srvstm',
  protocol: 'Icecast2 | HTTP Audio',
  slug: 'slug-do-provedor',
  streamUrl: 'link principal do streaming',
  fallbackUrl: 'fallback do streaming',
  fmMonitorUrl: 'link interno do retorno FM',
  fmFallbackUrl: 'link externo do retorno FM',
  metadataUrl: 'endpoint opcional de musica atual',
  aliases: [],
  metadataOfflineMeansDown: false
}
```

## Padrao de Links do Servidor Dell

Servidor interno dentro da Radio 88 FM:

```text
https://192.168.70.253:8873
```

Servidor externo para tecnico fora da rede:

```text
https://streaming.grupogtf.com.br:8873
```

Regra:

- Caminho sem `radiofm_`: usado como link normal de streaming quando nao houver outro link publico.
- Caminho com `radiofm_`: usado como retorno FM da radio.

Exemplo Uberaba:

```text
STREAMING publico: https://stm6.srvstm.com:7006/stream
FM interno:        https://192.168.70.253:8873/radiofm_uberaba
FM externo:        https://streaming.grupogtf.com.br:8873/radiofm_uberaba
```

Exemplo para radio cujo stream normal vem do proprio servidor Dell:

```text
STREAMING interno: https://192.168.70.253:8873/varginha
STREAMING externo: https://streaming.grupogtf.com.br:8873/varginha
FM interno:        https://192.168.70.253:8873/radiofm_varginha
FM externo:        https://streaming.grupogtf.com.br:8873/radiofm_varginha
```

## Radios Cadastradas Atualmente

Catalogo principal atualizado:

- Radio 88 FM - SEDE, Volta Redonda/RJ.
- 89 Maravilha FM - SEDE, Belo Horizonte/MG.
- Maravilha FM Cambui.
- Maravilha FM Barbacena.
- Maravilha FM Governador Valadares.
- Maravilha FM Ipatinga.
- Maravilha FM Juiz de Fora.
- Maravilha FM Joao Pinheiro.
- Maravilha FM Teofilo Otoni.
- Maravilha FM Campos Gerais.
- Maravilha FM Uba.
- Maravilha FM Montes Claros.
- Maravilha FM Uberlandia.
- Maravilha FM Uberaba.
- Maravilha FM Leopoldina.
- Maravilha FM Araxa.
- Maravilha FM Varginha.
- Maravilha FM Pouso Alegre.
- Maravilha FM Diamantina.

## Radios Adicionadas Nesta Etapa

### Varginha

```text
STREAMING interno: https://192.168.70.253:8873/varginha
STREAMING externo: https://streaming.grupogtf.com.br:8873/varginha
FM interno:        https://192.168.70.253:8873/radiofm_varginha
FM externo:        https://streaming.grupogtf.com.br:8873/radiofm_varginha
```

### Pouso Alegre

```text
STREAMING interno: https://192.168.70.253:8873/pousoalegre
STREAMING externo: https://streaming.grupogtf.com.br:8873/pousoalegre
FM interno:        https://192.168.70.253:8873/radiofm_pousoalegre
FM externo:        https://streaming.grupogtf.com.br:8873/radiofm_pousoalegre
```

### Diamantina

```text
STREAMING interno: https://192.168.70.253:8873/diamantina
STREAMING externo: https://streaming.grupogtf.com.br:8873/diamantina
FM interno:        https://192.168.70.253:8873/radiofm_diamantina
FM externo:        https://streaming.grupogtf.com.br:8873/radiofm_diamantina
```

## Fluxo de Monitoramento

1. O usuario seleciona as radios no filtro.
2. O frontend monta a lista `monitoredStreams`.
3. `watchStreams` abre `EventSource` para `/api/watch-many`.
4. O backend tenta ler bytes do `streamUrl`.
5. Se falhar, tenta `fallbackUrl`.
6. Para FM, o App monta outra lista usando `fmMonitorUrl` e `fmFallbackUrl`.
7. O backend envia eventos `online`, `offline`, `timeout` ou `checking`.
8. O card mostra status separado para `STREAMING` e `FM`.
9. Ao clicar em `Iniciar monitoramento`, o browser tambem inicia players e WebAudio para alimentar VU/waveform.

## Controles Operacionais

- `Iniciar monitoramento`: inicia players e medidores.
- `Mutar todos`: muta canais locais.
- `Reconectar todos`: recria players e reexecuta conexoes locais.
- Filtro de radios: permite monitorar todas, uma ou um conjunto especifico.
- Colunas 1/2/3/4: muda densidade visual do painel.
- Por card: volume, mute e reconectar para `STREAMING` e `FM`.

## Observacoes Tecnicas

- `src/data/streams.js` e a fonte principal usada pelo App.
- `src/data/streams 2.js` e legado e nao deve ser usado como fonte de verdade.
- Sempre que houver link externo e interno, manter os dois preenchidos.
- Para o FM, o link interno deve ficar em `fmMonitorUrl` e o externo em `fmFallbackUrl`.
- Para stream normal vindo do Dell, usar o caminho sem `radiofm_` em `streamUrl` e `fallbackUrl`.
- Para streaming publico de provedor, manter `streamUrl` original do provedor e usar Dell apenas no bloco FM.

## Limitacoes Atuais

- O cadastro de radios ainda esta chumbado em JavaScript.
- Nao existe tela administrativa para incluir radio.
- O monitoramento depende de players no navegador para modulacao WebAudio.
- Em Vercel, a funcao serverless tem limite de duracao; o EventSource reconecta.
- Deteccao de silencio ainda e visual/operacional, nao uma analise profissional via `ffmpeg`.


# PRD - Cadastro Dinamico de Radios e Streams

## 1. Resumo

Este PRD define a evolucao necessaria para remover o cadastro chumbado de radios em `src/data/streams.js` e permitir inclusao, edicao e desativacao de radios sem alterar codigo.

O objetivo e criar uma camada de configuracao administravel para radios, streams publicos, retornos FM, metadata e fallback interno/externo.

## 2. Problema

Hoje, para adicionar uma radio, e necessario editar codigo JavaScript, rebuildar e publicar novamente. Isso gera riscos:

- Erro manual de porta, slug ou URL.
- Divergencia entre `streams.js` e arquivos legados.
- Dependencia de desenvolvedor para operacao simples.
- Dificuldade de auditar quem alterou cada radio.
- Maior risco de quebrar radios existentes ao adicionar novas.

## 3. Objetivo

Permitir que operadores ou administradores cadastrem radios por uma interface ou arquivo de configuracao externo, sem mexer no codigo da aplicacao.

## 4. Escopo do MVP

- Fonte de dados externa para radios.
- Validacao de campos obrigatorios.
- Suporte a dois canais por radio: `STREAMING` e `FM`.
- Suporte a URL primaria e fallback por canal.
- Ativar/desativar radio.
- Ordenacao de exibicao no painel.
- Importacao de caminhos do servidor Dell.
- Documentacao de padrao de cadastro.

## 5. Fora do Escopo Inicial

- Controle remoto real de encoder.
- Autenticacao completa de administradores.
- Historico detalhado de alteracoes.
- Banco de dados relacional obrigatorio.
- Integracao automatica com painel dos provedores.

## 6. Modelo Recomendado de Configuracao

Primeira evolucao recomendada: arquivo JSON versionado em `public/config/streams.json` ou servido por endpoint backend.

Exemplo:

```json
{
  "version": 1,
  "fmBases": {
    "internal": "https://192.168.70.253:8873",
    "external": "https://streaming.grupogtf.com.br:8873"
  },
  "streams": [
    {
      "id": "maravilha-fm-varginha",
      "name": "Maravilha FM Varginha",
      "city": "Varginha",
      "state": "MG",
      "frequency": "Afiliada",
      "provider": "GTF Relay",
      "active": true,
      "order": 170,
      "stream": {
        "path": "varginha",
        "primaryUrl": "https://192.168.70.253:8873/varginha",
        "fallbackUrl": "https://streaming.grupogtf.com.br:8873/varginha"
      },
      "fm": {
        "path": "radiofm_varginha",
        "primaryUrl": "https://192.168.70.253:8873/radiofm_varginha",
        "fallbackUrl": "https://streaming.grupogtf.com.br:8873/radiofm_varginha"
      },
      "metadataUrl": null
    }
  ]
}
```

## 7. Regra Para Caminhos do Servidor Dell

Se o caminho tem `radiofm_`, ele representa o retorno FM:

```text
radiofm_uberaba -> FM
```

Se o caminho nao tem `radiofm_`, ele representa o streaming normal:

```text
uberaba -> STREAMING
```

Ao cadastrar uma radio com base no conf:

1. Identificar o path normal, se existir.
2. Identificar o path `radiofm_`, se existir.
3. Gerar URLs internas com `https://192.168.70.253:8873`.
4. Gerar URLs externas com `https://streaming.grupogtf.com.br:8873`.
5. Preencher `stream.primaryUrl`, `stream.fallbackUrl`, `fm.primaryUrl` e `fm.fallbackUrl`.

## 8. Requisitos Funcionais

- RF-01: Listar radios cadastradas.
- RF-02: Adicionar nova radio sem editar codigo.
- RF-03: Editar nome, cidade, estado, frequencia e ordem.
- RF-04: Configurar canal `STREAMING` com URL primaria e fallback.
- RF-05: Configurar canal `FM` com URL primaria e fallback.
- RF-06: Permitir gerar URLs automaticamente a partir de paths do servidor Dell.
- RF-07: Ativar ou desativar radio do painel.
- RF-08: Validar duplicidade de `id`.
- RF-09: Validar formato de URL.
- RF-10: Testar conectividade antes de salvar.
- RF-11: Exibir mensagem clara quando o FM nao estiver configurado.
- RF-12: Manter compatibilidade com `metadataUrl` dos provedores.

## 9. Requisitos Nao Funcionais

- RNF-01: A configuracao deve ser carregada antes de renderizar o painel.
- RNF-02: Erros no arquivo de configuracao nao podem derrubar a aplicacao inteira.
- RNF-03: Deve existir fallback local minimo caso a configuracao remota falhe.
- RNF-04: Campos sensiveis nao devem ir para o frontend.
- RNF-05: Alteracoes devem ser auditaveis na fase com banco de dados.

## 10. Arquitetura Recomendada

### Fase 1 - JSON externo

- Criar `public/config/streams.json`.
- Criar parser em `src/data/loadStreams.js`.
- Remover dependencia direta do array chumbado.
- Manter `streams.js` como fallback de emergencia.

### Fase 2 - API administrativa

- Criar backend com rotas:
  - `GET /api/admin/streams`
  - `POST /api/admin/streams`
  - `PUT /api/admin/streams/:id`
  - `DELETE /api/admin/streams/:id`
  - `POST /api/admin/streams/:id/test`
- Persistir em SQLite ou PostgreSQL.
- Adicionar login e permissao de administrador.

### Fase 3 - Importador de conf

- Criar tela para colar linhas `streampath_N=...`.
- Parser identifica paths normais e `radiofm_`.
- Sistema sugere pares por cidade/radio.
- Operador revisa e confirma.

## 11. Criterios de Aceite do MVP

- Uma radio nova pode ser adicionada alterando apenas JSON externo.
- O painel renderiza a nova radio sem rebuild.
- O sistema valida URLs obrigatorias.
- O retorno FM aparece separado do streaming.
- O fallback externo e usado quando o interno nao responde.
- A documentacao explica o padrao `radiofm_`.

## 12. Plano de Implementacao Sugerido

1. Criar schema JSON oficial dos streams.
2. Criar loader assíncrono no frontend.
3. Adaptar `App.jsx` para inicializar estados depois do carregamento.
4. Migrar o conteudo atual de `streams.js` para JSON.
5. Manter `streams.js` como fallback temporario.
6. Criar validador de configuracao.
7. Criar tela simples de administracao ou importador.
8. Evoluir persistencia para banco de dados.

## 13. Riscos

- Erro em JSON pode impedir renderizacao se nao houver fallback.
- URLs internas `192.168.70.253` nao funcionam fora da rede sem fallback externo.
- Certificado HTTPS interno pode gerar erro se nao for confiavel.
- Muitos players simultaneos podem continuar exigindo cuidado com limites do navegador.

## 14. Recomendacao Final

A melhor proxima etapa e migrar o catalogo para um `streams.json` externo com schema validado. Isso reduz risco operacional imediatamente sem exigir banco de dados ou tela administrativa completa no primeiro momento.


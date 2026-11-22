# ADR-0005: Imagem de Fallback Vive no Frontend, Nunca no Bucket

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-004`)

## Contexto
Produtos podem existir no catálogo sem nenhuma imagem associada (cadastro incompleto, falha no upload ou indisponibilidade temporária do object storage). Precisamos definir onde a imagem de fallback (placeholder visual de "sem imagem") deve residir e como a API representa produtos sem mídia.

## Decisão
- A imagem de fallback **vive exclusivamente no frontend** (como ativo estático empacotado no bundle do SPA ou SVG inline), **nunca** no bucket S3/SeaweedFS.
- Quando um produto não possui imagens prontas (`status = 'ready'`), a API retorna lista vazia (`images: []`) ou `primaryImage: null` — jamais uma URL sintética apontando para um arquivo de fallback no storage.
- O seed inicial (`T09`) preserva intencionalmente produtos sem imagem no banco/bucket para exercitar esse fluxo de fallback no frontend.

## Alternativas Consideradas
- **Subir uma imagem `fallback.webp` no bucket público e retorná-la na API:** descartado porque falha exatamente quando o storage está fora do ar ou inacessível (quebrando o próprio fallback), polui o modelo de dados com ativos artificiais e impede o frontend de distinguir "produto sem imagem" de "produto com imagem real".
- **Servir o fallback por um endpoint da API (`/media/fallback`):** descartado por acoplar um ativo puramente visual de UI ao backend e gerar tráfego desnecessário na API.

## Consequências
### Positivas
- O fallback funciona mesmo se o SeaweedFS/S3 ou a CDN estiverem completamente fora do ar.
- Contrato de dados limpo: ausência de imagem é representada explicitamente (`null` / `[]`), permitindo ao frontend adaptar o visual (inclusive tema claro/escuro e SVG inline sem emojis).
- Sem risco de cachear uma imagem de fallback com `immutable` sob uma chave de produto.

### Negativas / Trade-offs
- Cada cliente frontend (storefront, futuro backoffice) é responsável por renderizar seu próprio fallback visual quando `images` vier vazio.

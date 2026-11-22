# ADR-0004: Storage de Mídia S3-Compatível (SeaweedFS)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-003`)

## Contexto
O e-commerce precisa armazenar imagens originais de produtos e variantes otimizadas em WebP (miniatura, card e detalhe), servir ativos públicos do catálogo com cache imutável (`Cache-Control: public, max-age=31536000, immutable`) e manter um bucket privado separado para ativos não públicos, operando localmente a custo zero com portabilidade direta para produção (AWS S3, Cloudflare R2 ou equivalente).

## Decisão
- Adotar **SeaweedFS** (licença Apache 2.0) como object storage S3-compatível no ambiente local (`infra/compose.yaml`), acessado pela API via **AWS SDK v3 (`@aws-sdk/client-s3`)** com `endpoint` configurável e `forcePathStyle: true`.
- **Separação de responsabilidades:** bytes de mídia nunca são gravados no PostgreSQL nem em disco compartilhado entre containers; o banco guarda apenas metadados (`media.media_assets`: `storage_key`, `mime`, `size`, dimensões, `checksum`, `placeholder` base64 e `status`) e associações (`catalog.product_images`).
- **Chaves imutáveis:** objetos públicos usam chaves no formato `products/{productId}/{uuid}/{variant}.{ext}` e nunca são sobrescritos; o `Cache-Control: public, max-age=31536000, immutable` é enviado no upload.
- **Exposição de leitura pública no SeaweedFS (confirmado na documentação atual):**
  - Diferentemente do AWS S3 (que depende de Bucket Policy XML/JSON via API `PutBucketPolicy`), o SeaweedFS controla acesso anônimo de leitura através de sua configuração de identidades S3 (IAM interno), declarando uma identidade reservada chamada **`anonymous`** com permissão `Read` restrita ao bucket público.
  - Pode ser configurado de forma declarativa via arquivo JSON passado em `-s3.config=/etc/seaweedfs/s3.json` no boot do `weed server` (ou dinamicamente via `weed shell` com `s3.configure -buckets=<bucket> -user=anonymous -actions=Read -apply`):
    ```json
    {
      "identities": [
        {
          "name": "anonymous",
          "actions": ["Read:minieshop-catalog-public"]
        },
        {
          "name": "admin",
          "credentials": [
            { "accessKey": "...", "secretKey": "..." }
          ],
          "actions": ["Admin", "Read", "List", "Tagging", "Write"]
        }
      ]
    }
    ```
  - Adotamos a configuração declarativa (`-s3.config`) no container `storage` (gerada/montada em `infra/`) para que o bucket público (`catalog`) permita `GET`/`HEAD` anônimos pelo navegador desde o boot, enquanto o bucket privado exige credenciais/URLs assinadas — mantendo uma única fonte de verdade sem conflito entre config estática e dinâmica.
- **Endpoints interno vs. público:** a API usa o endpoint interno do Docker (`http://storage:8333`) para uploads/operações S3, e um endpoint público configurável (`http://localhost:8333`) para compor URLs acessíveis pelo navegador e URLs assinadas.

## Alternativas Consideradas
- **Guardar bytes (`bytea`) no PostgreSQL:** descartado por inflar backups/WAL, pressionar memória/cache de buffer do banco, impedir entrega direta via CDN/HTTP cache e degradar performance de consultas transacionais.
- **Pasta local / volume compartilhado entre API e proxy:** descartado por acoplar a API ao sistema de arquivos local, dificultar escalabilidade horizontal, não suportar URLs assinadas nem política por bucket e criar divergência entre dev e produção.
- **MinIO:** excelente compatibilidade S3, mas sua licença AGPLv3 e mudanças recentes na distribuição comunitária tornam o SeaweedFS (Apache 2.0, binário leve em Go com master/volume/filer/S3 unificados) uma alternativa mais simples e segura para licença permissiva.

## Consequências
### Positivas
- Zero acoplamento de código ao SeaweedFS: trocar para AWS S3 ou Cloudflare R2 em produção exige apenas mudar variáveis de ambiente (`S3_ENDPOINT`, credenciais, bucket).
- Leitura pública de imagens servida diretamente pelo storage com cache imutável, sem sobrecarregar a API Node.js.
- Separação clara entre bucket público do catálogo e bucket privado.

### Negativas / Trade-offs
- Exige configurar `s3.json` específico do SeaweedFS no ambiente local (em produção S3/R2, a exposição pública é feita via Bucket Policy / CDN).
- Requer atenção à diferença entre endpoint interno (container-to-container) e endpoint público (navegador/URLs assinadas).

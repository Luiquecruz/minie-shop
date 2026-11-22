CREATE TABLE "catalog"."product_embeddings" (
  "product_id" uuid PRIMARY KEY NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "embedding" vector(768) NOT NULL,
  "model" text NOT NULL,
  "content_hash" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "product_embeddings_hnsw_idx"
  ON "catalog"."product_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);

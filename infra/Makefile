ENV_FILE := $(if $(wildcard ../.env),../.env,$(if $(wildcard .env),.env,../.env.example))
COMPOSE := docker compose -f compose.yaml --env-file $(ENV_FILE)

.PHONY: up up-ai watch down logs ps seed test reset reset-ai

up:
	$(COMPOSE) up -d --build

up-ai:
	$(COMPOSE) --profile ai up -d --build

watch:
	$(COMPOSE) watch

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

seed:
	$(COMPOSE) --profile seed run --rm --build seed

test:
	cd .. && pnpm --filter @minieshop/api test && pnpm --filter @minieshop/api test:integration

reset:
	$(COMPOSE) --profile ai down -v --remove-orphans
	$(COMPOSE) up -d --build
	$(COMPOSE) --profile seed run --rm --build seed
	$(COMPOSE) exec -T worker pnpm outbox:wait-drain --consumers=search-index,catalog-category-fanout,recommendations --timeout=60000
	$(COMPOSE) exec -T worker pnpm search:status
	$(COMPOSE) exec -T worker pnpm relations:status
	@echo "[reset] Stack recreated cleanly (postgres, storage, search, migrate, seed, worker drained, search & relations in sync, api)."

reset-ai:
	$(COMPOSE) --profile ai down -v --remove-orphans
	$(COMPOSE) --profile ai up -d --build
	$(COMPOSE) --profile seed run --rm --build seed
	$(COMPOSE) exec -T worker pnpm outbox:wait-drain --consumers=search-index,embeddings,catalog-category-fanout,recommendations --timeout=240000
	$(COMPOSE) exec -T worker pnpm embeddings:status
	$(COMPOSE) exec -T worker pnpm search:status
	$(COMPOSE) exec -T worker pnpm relations:status
	@echo "[reset-ai] Stack recreated cleanly with AI profile (embeddings, search & vector relations in sync)."

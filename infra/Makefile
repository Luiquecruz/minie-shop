COMPOSE := docker compose -f compose.yaml --env-file $(if $(wildcard .env),.env,.env.example)

.PHONY: up watch down logs ps seed test reset

up:
	$(COMPOSE) up -d --build

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
	cd ../apps/api && pnpm test && pnpm test:integration

reset:
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build
	$(COMPOSE) --profile seed run --rm --build seed
	$(COMPOSE) exec -T worker pnpm outbox:wait-drain --consumers=search-index,catalog-category-fanout --timeout=60000
	$(COMPOSE) exec -T worker pnpm search:status
	@echo "[reset] Stack recreated cleanly (postgres, storage, search, migrate, seed, worker drained, search in sync, api)."

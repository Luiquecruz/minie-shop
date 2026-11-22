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
	$(COMPOSE) --profile seed run --rm seed

test:
	cd ../apps/api && pnpm test

reset:
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build
	$(COMPOSE) --profile seed run --rm seed
	@echo "[reset] Stack recreated cleanly (postgres, storage, init-buckets, migrate, seed, api)."

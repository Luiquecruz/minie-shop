COMPOSE := docker compose -f compose.yaml --env-file $(if $(wildcard .env),.env,.env.example)

.PHONY: up watch down logs ps reset

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

reset:
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build
	@echo "[reset] Stack recreated cleanly (postgres, storage, init-buckets, migrate, api)."

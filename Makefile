# Icon Selector Bundle - Development
.PHONY: help up down down-dev build shell install test test-coverage coverage-php-percent coverage-check cs-check cs-fix qa clean assets assets-build assets-watch assets-test test-ts test-e2e-csp ensure-up rector rector-dry phpstan igor release-check release-check-demos demo-smoke composer-sync update validate validate-translations check-no-cursor-coauthor check-open-prs strip-cursor-coauthor-from-history check-twig-extra

COMPOSE_FILE ?= docker-compose.yml
# Prefer Compose V2 plugin (GitHub Actions / modern Docker Desktop); fall back to docker-compose V1 (REQ-MAKE-010).
COMPOSE_BIN ?= $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
COMPOSE     ?= $(COMPOSE_BIN) -f $(COMPOSE_FILE)
SERVICE_PHP ?= php

help:
	@echo "Icon Selector Bundle - Development Commands"
	@echo ""
	@echo "  up              Start Docker container"
	@echo "  down            Stop Docker container"
	@echo "  down-dev        Stop root $(COMPOSE) (dev) and remove orphans"
	@echo "  build           Rebuild Docker image (no cache)"
	@echo "  shell           Open shell in container"
	@echo "  install         Install Composer + pnpm dependencies"
	@echo "  assets          Build TypeScript (pnpm install + pnpm run build)"
	@echo "  assets-build    Alias for assets"
	@echo "  assets-watch    Watch and rebuild TS on change"
	@echo "  test-ts         Run TypeScript (Vitest) unit tests"
	@echo "  assets-test     Alias of test-ts"
	@echo "  test-e2e-csp    Playwright under a nonce-only CSP (zero violations, zero third-party requests)"
	@echo "  test            Run PHPUnit tests"
	@echo "  test-coverage   Run tests with code coverage"
	@echo "  coverage-check  Fail if PHP Lines coverage < 99%%"
	@echo "  cs-check / cs-fix  Code style"
	@echo "  rector / rector-dry  Rector"
	@echo "  phpstan         Static analysis"
	@echo "  igor          Run Igor worker-state audit (REQ-CS-008)"
	@echo "  qa              cs-check + test"
	@echo "  release-check   Pre-release: hygiene, open PRs, QA, coverage-check, demos"
	@echo "  demo-smoke      Boot demos and assert HTTP 200"
	@echo "  composer-sync   Validate and align composer.lock"
	@echo "  clean           Remove vendor and cache"
	@echo "  update / validate  Composer"
	@echo "  check-open-prs  Fail if unresolved open GitHub PRs"
	@echo ""
	@echo "Demos: make -C demo/symfony8"

build:
	$(COMPOSE) build --no-cache

up:
	$(COMPOSE) build
	$(COMPOSE) up -d
	@sleep 3
	$(COMPOSE) exec -T $(SERVICE_PHP) composer install --no-interaction
	$(COMPOSE) exec -T -e CI=true $(SERVICE_PHP) pnpm install
	@echo "Container ready."

down:
	$(COMPOSE) down

down-dev:
	$(COMPOSE) down --remove-orphans

ensure-up:
	@if ! $(COMPOSE) exec -T $(SERVICE_PHP) true 2>/dev/null; then \
		$(COMPOSE) up -d; sleep 3; \
		$(COMPOSE) exec -T $(SERVICE_PHP) composer install --no-interaction; \
		$(COMPOSE) exec -T -e CI=true $(SERVICE_PHP) pnpm install; \
	fi

shell:
	$(COMPOSE) exec $(SERVICE_PHP) sh

install: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer install
	$(COMPOSE) exec -T -e CI=true $(SERVICE_PHP) pnpm install

assets: ensure-up
	$(COMPOSE) exec -T -e CI=true $(SERVICE_PHP) pnpm install
	$(COMPOSE) exec -T $(SERVICE_PHP) pnpm run build
	@echo "Assets built (src/Resources/public/icon-selector.js)."

assets-build: assets

assets-watch: ensure-up
	$(COMPOSE) exec $(SERVICE_PHP) pnpm run watch

# TypeScript/Vitest tests (bundle has TS)
test-ts: ensure-up
	$(COMPOSE) exec -T -e CI=true $(SERVICE_PHP) pnpm install --no-frozen-lockfile 2>/dev/null || true
	$(COMPOSE) exec -T $(SERVICE_PHP) pnpm run test:coverage | tee coverage-ts.txt
	sh .scripts/ts-coverage-percent.sh coverage-ts.txt
assets-test: test-ts

# Strict-CSP browser test (tests/E2eCsp): PHP built-in server in the php service + official Playwright image on the
# compose network. Asserts zero CSP violations and zero third-party requests for sources bundle and ux_icons_local.
# The image tag always follows the exact @playwright/test version pinned in tests/E2eCsp/playwright/package.json.
PLAYWRIGHT_VERSION := $(shell sed -n 's/.*"@playwright\/test": "\([0-9.]*\)".*/\1/p' tests/E2eCsp/playwright/package.json)
PLAYWRIGHT_IMAGE ?= mcr.microsoft.com/playwright:v$(PLAYWRIGHT_VERSION)-jammy
E2E_CSP_PORT ?= 8765
test-e2e-csp: ensure-up
	$(COMPOSE) exec -d -T $(SERVICE_PHP) sh -c 'echo $$$$ > /tmp/e2e-csp-server.pid; exec php -S 0.0.0.0:$(E2E_CSP_PORT) tests/E2eCsp/public/index.php'
	@sleep 1
	@NET=$$(docker inspect -f '{{range $$k, $$v := .NetworkSettings.Networks}}{{$$k}}{{end}}' $$($(COMPOSE) ps -q $(SERVICE_PHP))); \
	docker run --rm --network "$$NET" -u "$$(id -u):$$(id -g)" -e HOME=/tmp \
		-v "$(CURDIR)/tests/E2eCsp/playwright:/e2e" -w /e2e -e CI=$${CI:-} \
		-e E2E_BASE_URL=http://$(SERVICE_PHP):$(E2E_CSP_PORT) \
		$(PLAYWRIGHT_IMAGE) \
		bash -lc 'npm ci --no-fund --no-audit && npx playwright test'; status=$$?; \
	$(COMPOSE) exec -T $(SERVICE_PHP) sh -c 'kill "$$(cat /tmp/e2e-csp-server.pid)" 2>/dev/null; true'; exit $$status

test: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer install --no-interaction
	$(COMPOSE) exec $(SERVICE_PHP) composer test

test-coverage: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer install --no-interaction
	$(COMPOSE) exec $(SERVICE_PHP) composer test-coverage | tee coverage-php.txt
	sh .scripts/php-coverage-percent.sh coverage-php.txt

coverage-check: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) sh -lc 'composer test-coverage | tee coverage-php.txt'
	@./.scripts/coverage-fail-under.sh coverage-php.txt 99

cs-check: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer cs-check

cs-fix: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer cs-fix

rector: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer rector

rector-dry: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer rector-dry

phpstan: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer phpstan

# REQ-MAKE-004 / REQ-I18N-002: key parity across the 7 required locales + YAML syntax (no bin/console in a bundle).
validate-translations: ensure-up
	python3 .scripts/check-translation-key-parity.py
	$(COMPOSE) exec -T $(SERVICE_PHP) php -r 'require "vendor/autoload.php"; foreach (glob("src/Resources/translations/*.yaml") as $$f) { Symfony\Component\Yaml\Yaml::parseFile($$f); } echo "YAML OK\n";'

# REQ-TWIG-005: no raw <form>/<input>/<textarea>/<select> in Twig (bundle form themes are allowlisted).
check-no-raw-html-form:
	@chmod +x .scripts/check-no-raw-html-form.sh
	@./.scripts/check-no-raw-html-form.sh

qa: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer qa

composer-sync: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer validate --strict
	$(COMPOSE) exec -T $(SERVICE_PHP) composer install --no-interaction --prefer-dist


check-twig-extra:
	@chmod +x .scripts/check-twig-extra.sh
	@./.scripts/check-twig-extra.sh

# Run Igor worker-state audit (REQ-CS-008)
igor: ensure-up
	$(COMPOSE) exec -T php composer igor
# REQ-MAKE-002: sequential chain, ensure-up first.
release-check:
	@$(MAKE) ensure-up
	@$(MAKE) check-no-cursor-coauthor
	@$(MAKE) check-open-prs
	@$(MAKE) check-twig-extra
	@$(MAKE) check-no-raw-html-form
	@$(MAKE) composer-sync
	@$(MAKE) cs-fix
	@$(MAKE) cs-check
	@$(MAKE) rector-dry
	@$(MAKE) phpstan
	@$(MAKE) igor
	@$(MAKE) validate-translations
	@$(MAKE) coverage-check
	@$(MAKE) test-ts
	@$(MAKE) release-check-demos

release-check-demos:
	@$(MAKE) -C demo release-check

# REQ-TEST-011: boot demos and assert HTTP 200
demo-smoke:
	@if [ -f demo/Makefile ]; then $(MAKE) -C demo release-verify; else echo "No demo/Makefile"; exit 1; fi

clean:
	rm -rf vendor node_modules .phpunit.cache coverage .php-cs-fixer.cache

update: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer update --no-interaction

validate: ensure-up
	$(COMPOSE) exec -T $(SERVICE_PHP) composer validate --strict



setup-hooks:
	@chmod +x .githooks/pre-commit 2>/dev/null || true
	@chmod +x .githooks/commit-msg 2>/dev/null || true
	@git config core.hooksPath .githooks
	@echo "✅ Git hooks installed (.githooks — includes commit-msg for REQ-GIT-001)."

# REQ-MAKE-008: update-deps (REQ-MAKE-008)
BUNDLE_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
# Optional: monorepo helper absent on standalone GitHub Actions checkout (REQ-MAKE-009).
-include $(BUNDLE_ROOT)/../.scripts/Makefile.update-deps.mk
check-no-cursor-coauthor:
	@chmod +x .scripts/check-no-cursor-coauthor.sh
	@./.scripts/check-no-cursor-coauthor.sh HEAD

check-open-prs:
	@chmod +x .scripts/check-open-prs.sh
	@GH_REPO=nowo-tech/IconSelectorBundle ./.scripts/check-open-prs.sh

strip-cursor-coauthor-from-history:
	@chmod +x .scripts/strip-cursor-coauthor-from-history.sh
	@./.scripts/strip-cursor-coauthor-from-history.sh main

twig-lint: ensure-up
	@$(COMPOSE) exec -T $(SERVICE_PHP) composer twig:lint || $(COMPOSE) exec -T $(SERVICE_PHP) ./vendor/bin/twig-cs-fixer lint --config=.twig-cs-fixer.php

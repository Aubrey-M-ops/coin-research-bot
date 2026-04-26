.PHONY: install start test test-research test-daily-review typecheck check deploy-ssh

install:
	@echo "📦 Installing dependencies..."
	@bun install
	@echo "✅ Done"

start:
	@echo "🤖 Starting bot..."
	@bun run index.ts

test:
	@echo "🧪 Running tests..."
	@bun test

test-research:
	@echo "🔍 Testing /research message flow..."
	@bun run test/test-research.ts
	@echo "✅ Done"

test-daily-review:
	@echo "📅 Testing daily review message flow..."
	@bun run test/test-daily-review.ts
	@echo "✅ Done"

typecheck:
	@echo "🔍 Type checking..."
	@tsc --noEmit
	@echo "✅ No type errors"

check: typecheck test
	@echo "✅ All checks passed"

deploy-ssh:
	@echo "🚀 Deploying to VPS..."
	@bash scripts/deploy-ssh.sh
	@echo "✅ Deployment complete"

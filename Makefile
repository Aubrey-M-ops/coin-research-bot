.PHONY: install start test typecheck check deploy-ssh

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

.PHONY: install start typecheck deploy-ssh

install:
	bun install

start:
	bun run start

typecheck:
	bun run typecheck

deploy-ssh:
	bun run deploy:ssh

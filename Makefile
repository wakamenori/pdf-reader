# PDF Reader Makefile

.PHONY: help run setup lint format typecheck test clean

# Default target
help:
	@echo "PDF Reader - Available commands:"
	@echo ""
	@echo "  make run PDF=<file>          - Run PDF reader on specified file"
	@echo "  make run PDF=<file> ARGS=... - Run with additional arguments"
	@echo ""
	@echo "  Examples:"
	@echo "    make run PDF=sample.pdf"
	@echo "    make run PDF=sample.pdf ARGS='--workers 6 --dpi 400'"
	@echo "    make run PDF=sample.pdf ARGS='--resume-from 10'"
	@echo ""
	@echo "  Development commands:"
	@echo "    make setup    - Install dependencies"
	@echo "    make lint     - Run code linting"
	@echo "    make format   - Format code"
	@echo "    make typecheck- Run type checking"
	@echo "    make test     - Run tests"
	@echo "    make clean    - Clean output files"

# Main run command
run:
ifndef PDF
	@echo "Error: PDF file not specified"
	@echo "Usage: make run PDF=<filename> [ARGS='additional args']"
	@exit 1
endif
	pnpm tsx src/orchestrator.ts $(PDF) $(ARGS)

# Install dependencies
setup:
	pnpm install

# Code quality commands
lint:
	pnpm biome check src/

format:
	pnpm biome format --write src/

typecheck:
	pnpm tsc --noEmit

# Testing
test:
	pnpm vitest run

test-watch:
	pnpm vitest

# Cleanup
clean:
	rm -rf output/
	rm -rf logs/
	rm -rf dist/

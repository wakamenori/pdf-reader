# PDF Reader Makefile
#
# This Makefile provides convenient commands to run the PDF reader
# instead of having to use 'uv run' directly.

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
	@echo "    make setup    - Setup development environment"
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
	uv run python src/orchestrator.py $(PDF) $(ARGS)

# Development environment setup
setup:
	uv venv .venv
	uv sync

# Code quality commands
lint:
	uv run ruff check src/

format:
	uv run ruff format src/

typecheck:
	uv run mypy src/ --ignore-missing-imports

# Testing
test:
	uv run pytest

test-coverage:
	uv run pytest --cov=src --cov-report=html

# Cleanup
clean:
	rm -rf output/
	rm -rf logs/
	rm -rf .coverage
	rm -rf htmlcov/
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
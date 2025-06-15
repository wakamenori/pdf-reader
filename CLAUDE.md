# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a high-precision PDF-to-Markdown conversion system that processes scanned PDFs and outputs corrected Markdown files with extracted images. The system uses Google Gemini AI for intelligent text correction and formatting.

## Architecture

The system follows a pipeline architecture with these core components:

### Processing Pipeline

1. **Text Extraction** (`text_extractor.py`) - Extracts text from PDF pages using pdfplumber
2. **Markdown Drafting** (`markdown_drafter.py`) - Creates initial markdown with line numbers (L001: format)
3. **Page Rasterization** (`rasterizer.py`) - Converts PDF pages to high-resolution images
4. **AI Processing** (`gemini_client.py`) - Uses Gemini AI to analyze text+image and generate correction patches
5. **Patch Application** (`patch_applier.py`) - Applies AI-generated patches using structured `Patch` model
6. **Page Storage** (`page_store.py`) - Saves processed pages with metadata
7. **Final Assembly** (`assembler.py`) - Combines all pages into final.md

### Data Models

- **Patch Model** (`models.py`): Structured patches with types (replace/delete/insert), line numbers, and text
- **Answer Model**: Contains AI thinking process and list of patches

### Configuration System

- Main config: `configs/config.yaml` - controls DPI, workers, Gemini model, retries, output directory
- Environment: `.env` file for Google Cloud/Vertex AI credentials
- CLI overrides: Command-line arguments override config file values

## Key Commands

### Running the System

```bash
# Basic usage
uv run python src/orchestrator.py sample.pdf

# With custom settings
uv run python src/orchestrator.py sample.pdf \
  --config configs/config.yaml \
  --workers 6 \
  --dpi 400 \
  --resume-from 5

# Resume from specific page (1-indexed)
uv run python src/orchestrator.py sample.pdf --resume-from 10
```

### Development Commands

```bash
# Setup environment
uv venv .venv
source .venv/bin/activate
uv sync

# Code linting and formatting
uv run ruff check src/        # Lint check
uv run ruff format src/       # Format code
uv run mypy src/ --ignore-missing-imports  # Type check
```

### Prerequisites

- **Poppler**: Required for PDF processing
  - macOS: `brew install poppler`
  - Ubuntu: `sudo apt-get install poppler-utils`
- **Google Cloud Setup**: Vertex AI credentials in `.env` file

## Output Structure

Each run creates a timestamped directory in `output/`:

```
output/YYYYMMDD_HHMM/
├── pages/           # Individual page markdown files
├── images/          # PNG images of each page
└── sample.md         # Assembled final document
```

## Configuration Details

Key `config.yaml` parameters:

- `dpi`: Image resolution (default: 300)
- `workers`: Parallel processing threads (default: 4)  
- `gemini_model`: AI model version (currently "gemini-2.5-flash-preview-05-20")
- `max_retries`: API retry attempts (default: 3)
- `retry_backoff`: Exponential backoff multiplier (default: 2)

## Important Implementation Notes

- **Line Number System**: Text is processed with L001: prefixed line numbers for precise patch targeting
- **Parallel Processing**: Pages are processed concurrently using ThreadPoolExecutor
- **Cost Tracking**: Gemini API costs are logged and totaled for each run
- **Resume Capability**: Can restart processing from any page number
- **Error Handling**: Includes retry logic with exponential backoff for API calls
- **Logging**: Comprehensive logging to both console and timestamped log files in `logs/`

## AI Integration

The system uses a sophisticated AI workflow:

1. Sends draft markdown + page image to Gemini
2. AI analyzes content and identifies corrections needed
3. AI returns structured patches with reasoning (`thinking` field)
4. Patches are applied programmatically using line number targeting
5. All AI costs are tracked and reported


# How to Edit files


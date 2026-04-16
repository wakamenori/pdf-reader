# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a high-precision PDF-to-Markdown conversion system that processes scanned PDFs and outputs corrected Markdown files with extracted images. The system uses Google Gemini AI for intelligent text correction and formatting.

Built with TypeScript, runs on Node.js >= 22.

## Architecture

The system follows a pipeline architecture with these core components:

### Processing Pipeline

1. **Text Extraction** (`text-extractor.ts`) - Extracts text from PDF pages using pdfjs-dist
2. **Markdown Drafting** (`markdown-drafter.ts`) - Creates initial markdown with line numbers (L001: format)
3. **Page Rasterization** (`rasterizer.ts`) - Converts PDF pages to high-resolution PNG images using node-poppler
4. **AI Processing** (`gemini-client.ts`) - Uses Gemini AI to analyze text+image and generate correction patches
5. **Patch Application** (`patch-applier.ts`) - Applies AI-generated patches using structured `Patch` model
6. **Page Storage** (`page-store.ts`) - Saves processed pages as individual markdown files
7. **Final Assembly** (`assembler.ts`) - Combines all pages into final.md (with-images and pure variants)

### Data Models

- **Patch Model** (`models.ts`): Zod schemas for structured patches with types (replace/delete/insert), line numbers, and text
- **Answer Model**: Contains AI thinking process (`thinking`) and list of patches

### Configuration System

- Main config: `configs/config.yaml` - controls DPI, workers, Gemini model, retries, output directory
- Environment: `.env` file for `GEMINI_API_KEY`
- CLI overrides: Command-line arguments (via commander) override config file values

## Key Commands

### Running the System

```bash
# Basic usage (recommended)
make run PDF=sample.pdf

# With custom settings
make run PDF=sample.pdf ARGS="--config configs/config.yaml --workers 6 --dpi 400"

# Resume from specific page (1-indexed)
make run PDF=sample.pdf ARGS="--resume-from 10"

# Alternative: Direct pnpm usage
pnpm tsx src/orchestrator.ts sample.pdf
pnpm tsx src/orchestrator.ts sample.pdf --workers 6 --dpi 400 --resume-from 5
```

### Development Commands

```bash
# Setup environment (recommended)
make setup        # pnpm install

# Code quality (recommended)
make lint         # Biome lint check
make format       # Biome format
make typecheck    # tsc --noEmit
make test         # vitest run
make clean        # Clean output/logs/dist
```

### Prerequisites

- **Node.js**: >= 22.0.0
- **pnpm**: Package manager
- **Poppler**: Required for PDF page rasterization
  - macOS: `brew install poppler`
  - Ubuntu: `sudo apt-get install poppler-utils`
- **Gemini API Key**: Set `GEMINI_API_KEY` in `.env` file

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
- `gemini_model`: AI model version (currently "gemini-3.1-flash-lite-preview")
- `max_retries`: API retry attempts (default: 3)
- `retry_backoff`: Exponential backoff multiplier (default: 2)

## Important Implementation Notes

- **Line Number System**: Text is processed with L001: prefixed line numbers for precise patch targeting
- **Parallel Processing**: Pages are processed concurrently using p-limit for concurrency control
- **Cost Tracking**: Gemini API costs are logged and totaled for each run
- **Resume Capability**: Can restart processing from any page number
- **Error Handling**: Includes retry logic with exponential backoff for API calls
- **Logging**: Comprehensive logging to both console and timestamped log files in `logs/`
- **Validation**: Zod v4 schemas for structured AI response parsing

## AI Integration

The system uses a sophisticated AI workflow:

1. Sends draft markdown + page image to Gemini
2. AI analyzes content and identifies corrections needed
3. AI returns structured patches with reasoning (`thinking` field)
4. Patches are applied programmatically using line number targeting
5. All AI costs are tracked and reported


# How to Edit files


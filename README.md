# 高精度 PDF → Markdown 変換システム

## 概要

スキャンを含むPDFを解析し、校正済みMarkdown (`final.md`)とページ画像をローカルに出力するエンドツーエンドの変換パイプラインです。

## セットアップ

### 1. Popplerのインストール（必須）

- macOS: `brew install poppler`
- Ubuntu: `sudo apt-get install poppler-utils`

### 2. 仮想環境作成 & 依存インストール（推奨）

```bash
# Makefileを使用（推奨）
make setup

# または直接uvを使用
uv venv .venv
source .venv/bin/activate
uv sync
```

### 3. .envファイルの作成

`.env` にGemini APIキーを記載してください。

```env
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_PROJECT=<your-project-id>
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_VERTEX_AI=<json_text>
```

### 4. 設定ファイル

`configs/config.yaml` を編集して各種パラメータを調整できます。

```yaml
dpi: 300
workers: 4
gemini_model: "gemini-2.5-flash-preview-04-17"
max_retries: 3
retry_backoff: 2
log_level: "INFO"
output_dir: "output"
```

## 使い方

### 基本実行

```bash
# Makefileを使用（推奨）
make run PDF=sample.pdf

# または直接uvを使用
uv run python src/orchestrator.py sample.pdf
```

### オプション付き実行

```bash
# Makefileを使用（推奨）
make run PDF=sample.pdf ARGS="--config configs/config.yaml --workers 6 --dpi 400"
make run PDF=sample.pdf ARGS="--resume-from 5"

# または直接uvを使用
uv run python src/orchestrator.py sample.pdf \
  --config configs/config.yaml \
  --workers 6 \
  --dpi 400 \
  --resume-from 5
```

- CLI引数が未指定の場合は `config.yaml` の値を使用します。

### 開発・メンテナンス

```bash
# Makefileを使用（推奨）
make lint         # リント実行
make format       # フォーマット実行
make typecheck    # 型チェック実行
make test         # テスト実行
make clean        # 出力ファイル削除

# または直接uvを使用
uv run ruff check src/        # リント実行
uv run ruff format src/       # フォーマット実行
uv run mypy src/ --ignore-missing-imports  # 型チェック実行
```

### 利用可能なコマンド

```bash
make help    # 利用可能なコマンド一覧を表示
```

## ディレクトリ構成

```text
project/
├── configs/
│   └── config.yaml
├── .env
├── requirements.txt
├── src/
│   ├── orchestrator.py
│   ├── text_extractor.py
│   ├── markdown_drafter.py
│   ├── rasterizer.py
│   ├── gemini_client.py
│   ├── patch_applier.py
│   └── assembler.py
└── output/
    └── <timestamp>/
        ├── pages/
        ├── images/
        └── final.md
```

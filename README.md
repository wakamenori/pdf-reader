# 高精度 PDF → Markdown 変換システム

## 概要

スキャンを含むPDFを解析し、校正済みMarkdown (`final.md`)とページ画像をローカルに出力するエンドツーエンドの変換パイプラインです。

## セットアップ

### 1. Popplerのインストール（必須）

- macOS: `brew install poppler`
- Ubuntu: `sudo apt-get install poppler-utils`

### 2. 仮想環境作成 & 依存インストール（uv推奨）

```bash
uv venv .venv
source .venv/bin/activate
uv sync
```

### 3. .envファイルの作成

`.env` にGemini APIキーを記載してください。

```
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

```bash
uv run -m src/orchestrator sample.pdf
```

```bash
uv run -m src/orchestrator sample.pdf \
  --config configs/config.yaml \
  --workers 6 \
  --dpi 400 \
```
- CLI引数が未指定の場合は `config.yaml` の値を使用します。

## ディレクトリ構成

```
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

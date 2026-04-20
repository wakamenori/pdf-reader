# 高精度 PDF → Markdown 変換システム

## 概要

スキャンを含むPDFを解析し、Google Gemini による校正を経て Markdown に変換するエンドツーエンドのパイプラインです。TypeScript 実装で Node.js >= 22 上で動作します。

成果物は **入力PDFと同じディレクトリ** に `<pdf名>.md` として書き出され、中間生成物とログは `/tmp/pdf-reader/<timestamp>/` に保存されます。

## セットアップ

### 1. Popplerのインストール（必須）

ページ画像のラスタライズに利用します。

- macOS: `brew install poppler`
- Ubuntu: `sudo apt-get install poppler-utils`

### 2. 依存インストール

```bash
# Makefile（推奨）
make setup

# または直接
pnpm install
```

### 3. .env ファイルの作成

Gemini API キーを `.env` に設定してください。

```env
GEMINI_API_KEY=<your-api-key>
```

### 4. 設定ファイル

`configs/config.yaml` で各種パラメータを調整できます。

```yaml
dpi: 300
workers: 4
gemini_model: "gemini-3.1-flash-lite-preview"
max_retries: 3
retry_backoff: 2            # 初回1秒, 次回2秒, その次4秒…
log_level: "INFO"
mermaid_max_retries: 5      # mermaid構文エラー時のGemini修正リトライ回数
```

## 使い方

### 基本実行

```bash
# Makefile（推奨）
make run PDF=sample.pdf

# または直接
pnpm tsx src/orchestrator.ts sample.pdf
```

### オプション付き実行

```bash
make run PDF=sample.pdf ARGS="--config configs/config.yaml --workers 6 --dpi 400"
make run PDF=sample.pdf ARGS="--resume-from 10"
make run PDF=sample.pdf ARGS="--with-images"
make run PDF=sample.pdf ARGS="--verbose"
```

CLI引数が未指定の場合は `config.yaml` の値を使用します。

| オプション | 説明 |
| --- | --- |
| `--config <path>` | 設定ファイルパス（既定 `configs/config.yaml`） |
| `--workers <n>` | 並列ワーカー数 |
| `--dpi <n>` | 画像DPI |
| `--resume-from <n>` | 指定ページ番号（1始まり）から再開 |
| `--with-images` | ページ画像付きの `.with-images.md` も出力する |
| `--verbose` | diff や Gemini レスポンスなど詳細ログを console に出す |

### 開発・メンテナンス

```bash
make lint         # Biome による lint
make format       # Biome による format
make typecheck    # tsc --noEmit
make test         # vitest run
make clean        # /tmp/pdf-reader と dist を削除
```

```bash
make help         # 利用可能なコマンド一覧
```

## 出力構成

```text
<input PDF dir>/
├── sample.pdf
├── sample.md                  # pure markdown（デフォルト出力）
├── sample.with-images.md      # --with-images 指定時のみ
└── sample_images/             # --with-images 指定時のみ（ページ画像）

/tmp/pdf-reader/YYYYMMDD_HHMM/
├── pages/                     # ページ別中間markdown
├── images/                    # ページ画像（ラスタライズ結果）
└── run.log                    # 実行ログ
```

同名ファイルが既に存在する場合は `sample_2.md`, `sample_3.md`... と連番が付与されます。

## 必要環境

- **Node.js**: >= 22.0.0
- **pnpm**
- **Poppler**（`pdftoppm` 等を利用）
- **Gemini API Key**（`.env` の `GEMINI_API_KEY`）

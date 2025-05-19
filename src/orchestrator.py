"""
orchestrator.py

PDF → Markdown 変換パイプラインのエントリーポイント。
"""

import argparse
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import yaml

from assembler import assemble_final_md
from gemini_client import get_gemini_patch
from markdown_drafter import draft_markdown
from page_store import store_page
from patch_applier import apply_patch
from rasterizer import rasterize_page
from text_extractor import extract_text_lines

# TODO: YAMLから読み込んだ値を各種関数に渡すようにする。現状は個別ファイル内でハードコードされている


def load_config(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def setup_logger(log_dir, log_level):
    os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    log_file = os.path.join(log_dir, f"run_{timestamp}.log")
    log_fmt = "[%(asctime)s] %(levelname)s %(name)s - %(message)s"
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), "INFO"),
        format=log_fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
    )


def parse_args():
    parser = argparse.ArgumentParser(description="PDF → Markdown 変換パイプライン")
    parser.add_argument("pdf_path", type=str, help="入力PDFファイルパス")
    parser.add_argument(
        "--config", type=str, default="configs/config.yaml", help="設定ファイルパス"
    )
    parser.add_argument("--workers", type=int, help="並列ワーカー数")
    parser.add_argument("--dpi", type=int, help="画像DPI")
    parser.add_argument(
        "--resume-from", type=int, default=1, help="このページ番号から再開（1始まり）"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    config = load_config(args.config)

    # CLI引数で上書き
    workers = args.workers if args.workers else config.get("workers", 4)
    dpi = args.dpi if args.dpi else config.get("dpi", 300)
    log_level = config.get("log_level", "INFO")
    output_dir = config.get("output_dir", "output")

    # タイムスタンプ付き出力ディレクトリ
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    run_output_dir = os.path.join(output_dir, timestamp)
    pages_dir = os.path.join(run_output_dir, "pages")
    images_dir = os.path.join(run_output_dir, "images")
    os.makedirs(pages_dir, exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)

    # ログ初期化
    setup_logger("logs", log_level)
    logger = logging.getLogger("orchestrator")
    logger.info(f"Started processing: {args.pdf_path}")

    # PDFページ数取得
    import pdfplumber

    with pdfplumber.open(args.pdf_path) as pdf:
        num_pages = len(pdf.pages)

    logger.info(f"Total pages: {num_pages}")

    # 再開ページ番号（1始まり→0始まりに変換）
    resume_from = max(args.resume_from - 1, 0)

    # Page Worker 処理
    gemini_model = config.get("gemini_model", "gemini-2.5-flash-preview-04-17")
    max_retries = config.get("max_retries", 3)
    retry_backoff = config.get("retry_backoff", 2)
    def process_page(page_num):
        logger.info(f"Started page {page_num + 1}")
        # 1. テキスト抽出
        draft_md = extract_text_lines(args.pdf_path, page_num, dpi)
        # 2. Markdown整形
        md = draft_markdown(draft_md)
        # 3. 画像生成
        image_path = rasterize_page(args.pdf_path, page_num, dpi, images_dir)
        # 4. Geminiパッチ取得
        answer, price = get_gemini_patch(md, image_path, gemini_model, max_retries, retry_backoff)
        logger.info(f"Gemini patch cost: ${price:.4f}")
        # 5. パッチ適用
        fixed_md = apply_patch(md, answer)
        # 6. ページ保存
        page_md_path = store_page(fixed_md, page_num, pages_dir, image_path)
        logger.info(f"Finished page {page_num + 1}")
        return page_md_path, price

    # 並列実行
    page_md_paths = []
    total_price = 0.0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        # resume_from未満のページはスキップ
        futures = {
            executor.submit(process_page, i): i for i in range(resume_from, num_pages)
        }
        for future in as_completed(futures):
            page_md_path, price = future.result()
            page_md_paths.append(page_md_path)
            total_price += price
    logger.info(f"Total cost: ${total_price:.4f}")

    # ページ順に並べ替え
    page_md_paths.sort()

    # アセンブル
    final_md_path = assemble_final_md(page_md_paths, run_output_dir, images_dir)
    logger.info(f"Output: {final_md_path}")


if __name__ == "__main__":
    main()

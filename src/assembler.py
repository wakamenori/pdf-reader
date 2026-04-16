"""
assembler.py

ページごとの Markdown を連結し、最終的な final.md を生成するモジュール。
"""

import logging
import os
import re

logger = logging.getLogger(__name__)


def _fix_unclosed_code_blocks(page_md: str, page_num: int) -> str:
    """閉じられていないコードブロックを検出し、末尾に閉じタグを追加する。"""
    open_count = 0
    close_count = 0
    for line in page_md.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") and len(stripped) > 3:
            open_count += 1
        elif stripped == "```":
            close_count += 1
    if open_count > close_count:
        missing = open_count - close_count
        logger.warning(f"Page {page_num}: {missing}個の閉じられていないコードブロックを検出。自動で閉じます。")
        page_md += "\n```" * missing
    return page_md


def assemble_final_md(page_md_paths, run_output_dir, images_dir, pdf_filename):
    """
    ページMDを番号順に連結し、2種類のMDファイルを生成する。
    - 画像付きバージョン: ページ先頭に元のページ画像リンクを挿入
    - ピュアMarkdownバージョン: テキストのみ

    Args:
        page_md_paths (list[str]): ページMDファイルパスのリスト(番号順)
        run_output_dir (str): 出力ディレクトリ(output/<timestamp>/)
        images_dir (str): 画像ディレクトリ
        pdf_filename (str): 元のPDFファイル名

    Returns:
        tuple[str, str]: (画像付きMDファイルパス, ピュアMDファイルパス)
    """
    pages_with_images = []
    pages_pure = []
    for i, md_path in enumerate(page_md_paths, 1):
        with open(md_path, encoding="utf-8") as f:
            page_md = f.read()
        # 行番号除去
        page_md = re.sub(r"^L\d{3}:\s?", "", page_md, flags=re.MULTILINE)
        # 閉じられていないコードブロックを修正
        page_md = _fix_unclosed_code_blocks(page_md, i)
        pages_pure.append(f"<!-- page {i} -->\n\n" + page_md.strip())
        # ページ先頭に画像リンクを挿入したバージョン
        image_name = f"page_{str(i).zfill(3)}.png"
        image_rel_path = os.path.relpath(os.path.join(images_dir, image_name), run_output_dir)
        page_with_image = f"![page {i}]({image_rel_path})\n\n" + page_md
        pages_with_images.append(page_with_image.strip())

    basename = os.path.splitext(os.path.basename(pdf_filename))[0]

    # 画像付きバージョン
    final_with_images = "\n\n---\n\n".join(pages_with_images)
    with_images_path = os.path.join(run_output_dir, f"{basename}.md")
    with open(with_images_path, "w", encoding="utf-8") as f:
        f.write(final_with_images)

    # ピュアMarkdownバージョン
    final_pure = "\n\n---\n\n".join(pages_pure)
    pure_path = os.path.join(run_output_dir, f"{basename}_pure.md")
    with open(pure_path, "w", encoding="utf-8") as f:
        f.write(final_pure)

    return with_images_path, pure_path

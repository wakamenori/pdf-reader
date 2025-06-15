"""
page_store.py

校正版MarkdownとPNG画像を output/<timestamp>/pages/ 配下に保存するモジュール。
"""

import os


def store_page(fixed_md, page_num, pages_dir):
    """
    校正版Markdownをページごとに保存する。

    Args:
        fixed_md (str): 校正済みMarkdown(行番号付き)
        page_num (int): 0始まりのページ番号
        pages_dir (str): Markdown保存ディレクトリ

    Returns:
        str: 保存したMarkdownファイルのパス
    """
    os.makedirs(pages_dir, exist_ok=True)
    md_path = os.path.join(pages_dir, f"page_{str(page_num + 1).zfill(3)}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(fixed_md)
    return md_path

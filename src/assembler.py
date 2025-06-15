"""
assembler.py

ページごとの Markdown を連結し、最終的な final.md を生成するモジュール。
"""

import os
import re


def assemble_final_md(page_md_paths, run_output_dir, images_dir, pdf_filename):
    """
    ページMDを番号順に連結し、行番号除去・画像リンク修正を行い、PDF名ベースのMDファイルを生成する。

    Args:
        page_md_paths (list[str]): ページMDファイルパスのリスト(番号順)
        run_output_dir (str): 出力ディレクトリ(output/<timestamp>/)
        images_dir (str): 画像ディレクトリ
        pdf_filename (str): 元のPDFファイル名

    Returns:
        str: 生成したMDファイルのパス
    """
    all_md = []
    for i, md_path in enumerate(page_md_paths, 1):
        with open(md_path, encoding="utf-8") as f:
            page_md = f.read()
        # 行番号除去
        page_md = re.sub(r"^L\d{3}:\s?", "", page_md, flags=re.MULTILINE)
        # ページ先頭に画像リンクを挿入
        image_name = f"page_{str(i).zfill(3)}.png"
        image_rel_path = os.path.relpath(os.path.join(images_dir, image_name), run_output_dir)
        page_md = f"![page {i}]({image_rel_path})\n\n" + page_md
        all_md.append(page_md.strip())

    final_md = "\n\n---\n\n".join(all_md)
    # PDFファイル名から拡張子を除去して.mdを付加
    md_filename = os.path.splitext(os.path.basename(pdf_filename))[0] + ".md"
    final_md_path = os.path.join(run_output_dir, md_filename)
    with open(final_md_path, "w", encoding="utf-8") as f:
        f.write(final_md)
    return final_md_path

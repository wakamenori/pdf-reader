"""
rasterizer.py

pdf2image を用いて PDF ページ画像（PNG）を生成するモジュール。
"""

import os

from pdf2image import convert_from_path


def rasterize_page(pdf_path, page_num, dpi, images_dir):
    """
    指定したPDFページをPNG画像として保存する。

    Args:
        pdf_path (str): PDFファイルのパス
        page_num (int): 0始まりのページ番号
        dpi (int): 画像DPI
        images_dir (str): 画像保存ディレクトリ

    Returns:
        str: 生成した画像ファイルのパス
    """
    # pdf2imageは1始まりなので+1
    images = convert_from_path(
        pdf_path, dpi=dpi, first_page=page_num + 1, last_page=page_num + 1
    )
    image = images[0]
    os.makedirs(images_dir, exist_ok=True)
    image_path = os.path.join(images_dir, f"page_{str(page_num + 1).zfill(3)}.png")
    image.save(image_path, "PNG")
    return image_path

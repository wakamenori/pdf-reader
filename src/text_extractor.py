"""
text_extractor.py

pdfplumber を用いて PDF ページから行番号付きテキストを抽出するモジュール。
"""

import pdfplumber


def extract_text_lines(pdf_path, page_num):
    """
    指定したPDFページから行番号付きテキスト(L001: ...)を抽出する。

    Args:
        pdf_path (str): PDFファイルのパス
        page_num (int): 0始まりのページ番号

    Returns:
        str: 行番号付きDraft Markdown(1ページ分)
    """
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]
        text = page.extract_text()
        if not text or not text.strip():
            return "L000: (EMPTY)"
        lines = text.splitlines()
        md_lines = []
        for i, line in enumerate(lines, 1):
            md_lines.append(f"L{str(i).zfill(3)}: {line}")
        return "\n".join(md_lines)

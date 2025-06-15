"""
markdown_drafter.py

抽出テキストを Markdown 記法に整形するモジュール。
"""

import re


def draft_markdown(draft_md):
    """
    行番号付きDraft Markdownを、箇条書き・見出し・簡易表をMarkdown記法に整形する。

    Args:
        draft_md (str): L001: ... 形式の行番号付きDraft Markdown

    Returns:
        str: Markdown整形済みテキスト(行番号付き)
    """
    lines = draft_md.splitlines()
    md_lines = []
    for line in lines:
        # 行番号部分と本文に分割
        m = re.match(r"^(L\d{3}:\s)(.*)$", line)
        if not m:
            md_lines.append(line)
            continue
        prefix, content = m.groups()

        # 箇条書き
        if re.match(r"^[・\-•]\s+", content):
            content = "- " + content[2:].lstrip()
        # 見出し(例: "第1章", "1.", "1.", "1 " で始まる)
        elif re.match(r"^(第?\d+章|[0-9]+[\..\s])", content):
            content = "# " + content
        # 簡易表(タブ区切り or 全角スペース区切りが2つ以上)
        elif "\t" in content or re.search(r"　{2,}", content):
            # タブ→|、全角スペース2つ以上→|
            content = "| " + re.sub(r"(\t|　{2,})", " | ", content) + " |"

        md_lines.append(prefix + content)
    return "\n".join(md_lines)

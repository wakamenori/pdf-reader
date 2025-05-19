"""
patch_applier.py

Gemini から取得したパッチを Draft Markdown に適用するモジュール。
"""

import difflib
import re

from models import Answer

# ANSIカラーコード
RED = "\033[91m"
GREEN = "\033[92m"
ENDC = "\033[0m"


def color_diff(before, after):
    before_lines = before.splitlines()
    after_lines = after.splitlines()
    diff = difflib.ndiff(before_lines, after_lines)
    result = []
    for line in diff:
        if line.startswith("- "):
            result.append(f"{RED}{line}{ENDC}")
        elif line.startswith("+ "):
            result.append(f"{GREEN}{line}{ENDC}")
        else:
            result.append(line)
    return "\n".join(result)


def apply_patch(md, answer: Answer):
    """
    Draft MarkdownにJSONパッチ（replace/delete/insert）を順に適用し、校正済みページMDを生成する。
    Args:
        md (str): 行番号付きDraft Markdown
        patches (list[dict]): パッチリスト（JSON形式: type/line/text）
    Returns:
        str: パッチ適用済みMarkdown（行番号付き）
    """
    md_lines = md.splitlines()
    # line_mapの構築
    line_map = {}
    for i, md_line in enumerate(md_lines):
        m = re.match(r"^L(\d{3}):", md_line)
        if m:
            line_map[int(m.group(1))] = i
    before_md = "\n".join(md_lines)
    patches = answer.patches
    for patch in patches:
        patch_type = patch.type
        patch_line_number = patch.line
        text = getattr(patch, "text", None)
        if patch_type == "replace" and patch_line_number in line_map:
            idx = line_map[patch_line_number]
            prefix = md_lines[idx][:6]  # "Lxxx: "
            after = f"{prefix}{text}"
            md_lines[idx] = after
        elif patch_type == "delete" and patch_line_number in line_map:
            idx = line_map[patch_line_number]
            md_lines[idx] = None  # 削除
        elif patch_type == "insert":
            # 新しい行番号は直後の最大+1
            max_lineno = 0
            for md_line in md_lines:
                if md_line:
                    m2 = re.match(r"^L(\d{3}):", md_line)
                    if m2:
                        max_lineno = max(max_lineno, int(m2.group(1)))
            new_lineno = max_lineno + 1
            new_line = f"L{str(new_lineno).zfill(3)}: {text}"
            if patch_line_number in line_map:
                idx = line_map[patch_line_number]
                md_lines.insert(idx + 1, new_line)
            elif patch_line_number == new_lineno:
                # 末尾に追加
                md_lines.append(new_line)
            # line_mapを再構築
            line_map = {}
            for i, md_line in enumerate(md_lines):
                m2 = re.match(r"^L(\d{3}):", md_line) if md_line else None
                if m2:
                    line_map[int(m2.group(1))] = i
    # None（DELETE）を除外
    md_lines = [md_line for md_line in md_lines if md_line is not None]
    after_md = "\n".join(md_lines)
    print("\n===== ページ全体の差分 =====")
    print(color_diff(before_md, after_md))
    return after_md

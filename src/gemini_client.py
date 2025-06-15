"""
gemini_client.py

Gemini 2.0 Flash-Lite API へリクエストし、パッチを取得するモジュール。
"""

import json
import os
import pprint
import re
import time

import google.genai as genai
from dotenv import load_dotenv
from google.genai import types
from google.oauth2 import service_account

from models import Answer


def extract_patches(text):
    """
    Gemini応答からREPLACE/INSERT/DELETEパッチのみ抽出する。
    """
    pattern = r"(REPLACE L\d{3}: .+|DELETE L\d{3}|INSERT AFTER L\d{3}: .+)"
    return re.findall(pattern, text)


def get_gemini_patch(md, image_path, model_name, max_retries, retry_backoff) -> tuple[Answer, float]:
    """
    画像とDraft MarkdownをGeminiに送信し、パッチを取得し、LLM料金も返す。
    Args:
        md (str): Draft Markdown(行番号付き)
        image_path (str): ページ画像ファイルパス
        model_name (str): 使用するGeminiモデル名
        max_retries (int): リトライ最大回数
        retry_backoff (int): リトライ時のバックオフ秒数
    Returns:
        tuple[Answer, float]: (パッチリスト(Pydanticモデルのリスト), 料金[ドル])
    """
    load_dotenv()
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_VERTEX_AI")
    if not service_account_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_VERTEX_AI is not set in .env")
    service_account_info = json.loads(service_account_json)
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    credentials = service_account.Credentials.from_service_account_info(service_account_info).with_scopes(scopes)
    client = genai.Client(credentials=credentials)
    prompt = """
        以下のMarkdownテキスト(行番号付き)と、その元になったページ画像をあたえます。
        マークダウンテキストを画像と比較し、テキストが適切でない部分を探し、見つかれば修正を提案してください。

        # Rules
        1. 文字化されていない図を<alt_image>タグで囲んだテキストデータとして追加する
           - 図のタイトルと説明をテキストとして与える
                - <alt_image title="図のタイトル"> 図を説明するテキスト </alt_image>
           - 図のコンテキストを踏まえ、必要な部分だけテキスト化する
        2. 表を<table>タグで囲んだテキストデータとして追加・整形する
            - 整形されていない元のテキストの行は完全に削除する
            - <table> <tr> <td> テキスト </td> </tr> </table> のように、テキストを整形する
        3. ページのヘッダーとフッターにあるタイトルやページ数が含まれていれば、それをDELETEする
        4. ただし、以下の違いは許容するため、修正せずに放置する
            - 句読点の違い(全角・半角)
            - 記号の全角・半角の違い
            - それ自体が意味を持たない記号の細かな違い

        まず、全体を見た上で修正する方針を決めてください。
        - 修正なし
        - テキストを含む図が文字起こしされていないため、テキストを追加する
        - 表が含まれているが、構造が認識されていないため、Markdownの表として追加する
        など

        typeは'replace'/'delete'/'insert'のいずれか。
        lineは対象行番号(例: L003なら3)。
        replace/insertはtext必須。deleteはtext不要。
    """
    with open(image_path, "rb") as f:
        image_data = f.read()
    image_part = types.Part.from_bytes(data=image_data, mime_type="image/png")
    prompt_part = types.Part.from_text(text=prompt)
    md_part = types.Part.from_text(text=md)
    user_content = types.Content(parts=[image_part, prompt_part, md_part], role="user")

    last_exception = None
    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_content,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": Answer,
                },
            )
            answer = Answer.model_validate(response.parsed)
            pprint.pprint(answer)
            usage_metadata = response.usage_metadata

            prompt_token_count = getattr(usage_metadata, "prompt_token_count", None)
            candidates_token_count = getattr(usage_metadata, "candidates_token_count", None)
            if prompt_token_count is None or candidates_token_count is None:
                raise RuntimeError("usage_metadataからトークン数が取得できませんでした")
            input_price = prompt_token_count / 1_000_000 * 0.15
            output_price = candidates_token_count / 1_000_000 * 0.6
            total_price = input_price + output_price

            return answer, total_price
        except Exception as e:
            last_exception = e
            wait_time = retry_backoff * (2 ** (attempt - 1))
            print(f"[Gemini] エラー発生({attempt}回目): {e}. {wait_time}秒後にリトライします。")
            time.sleep(wait_time)
    # 規定回数失敗した場合は例外を投げる
    raise RuntimeError(f"Gemini APIの呼び出しに{max_retries}回失敗しました: {last_exception}")

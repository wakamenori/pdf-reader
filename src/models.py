from typing import Literal

from pydantic import BaseModel, Field


class Patch(BaseModel):
    type: Literal["replace", "delete", "insert"] = Field(
        description="パッチの種類。'replace' | 'delete' | 'insert'のいずれか。"
    )
    line: int = Field(description="対象行番号(例: L003なら3)。")
    text: str | None = Field(description="置換するテキスト。typeが'replace' | 'insert'の場合のみ必要。")


class Answer(BaseModel):
    thinking: str = Field(description="思考過程。ヘッダー・フッター、図の説明、表の整形などの修正方針を記述する。")
    patches: list[Patch]

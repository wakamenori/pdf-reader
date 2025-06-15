import pytest

from src.models import Answer, Patch


def test_patch_replace():
    patch = Patch(type="replace", line=3, text="新しいテキスト")
    assert patch.type == "replace"
    assert patch.line == 3
    assert patch.text == "新しいテキスト"


def test_patch_delete():
    patch = Patch(type="delete", line=5, text=None)
    assert patch.type == "delete"
    assert patch.line == 5
    assert patch.text is None


def test_patch_insert():
    patch = Patch(type="insert", line=1, text="挿入テキスト")
    assert patch.type == "insert"
    assert patch.line == 1
    assert patch.text == "挿入テキスト"


def test_answer_model():
    patches = [Patch(type="replace", line=1, text="修正テキスト"), Patch(type="delete", line=2, text=None)]
    answer = Answer(thinking="修正の理由", patches=patches)

    assert answer.thinking == "修正の理由"
    assert len(answer.patches) == 2
    assert answer.patches[0].type == "replace"
    assert answer.patches[1].type == "delete"


def test_patch_validation_invalid_type():
    with pytest.raises(ValueError):
        Patch(type="invalid", line=1, text="test")


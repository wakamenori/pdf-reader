
from src.models import Answer, Patch
from src.patch_applier import apply_patch, color_diff


def test_color_diff():
    before = "古いテキスト\n変更されない行"
    after = "新しいテキスト\n変更されない行"
    result = color_diff(before, after)
    assert "古いテキスト" in result
    assert "新しいテキスト" in result


def test_apply_patch_replace():
    draft = "L001: 古いテキスト\nL002: 変更されない行"
    patches = [Patch(type="replace", line=1, text="新しいテキスト")]
    answer = Answer(thinking="テスト用の修正", patches=patches)

    result = apply_patch(draft, answer)
    assert "L001: 新しいテキスト" in result
    assert "L002: 変更されない行" in result


def test_apply_patch_delete():
    draft = "L001: 削除される行\nL002: 残る行"
    patches = [Patch(type="delete", line=1, text=None)]
    answer = Answer(thinking="行を削除", patches=patches)

    result = apply_patch(draft, answer)
    assert "削除される行" not in result
    assert "L002: 残る行" in result

import { describe, expect, it } from "vitest";
import type { Answer } from "../src/models.js";
import { applyPatch, colorDiff } from "../src/patch-applier.js";

describe("colorDiff", () => {
	it("差分を含むカラー文字列を生成する", () => {
		const before = "古いテキスト\n変更されない行";
		const after = "新しいテキスト\n変更されない行";
		const result = colorDiff(before, after);
		expect(result).toContain("古いテキスト");
		expect(result).toContain("新しいテキスト");
	});
});

describe("applyPatch", () => {
	it("replaceパッチを適用する", () => {
		const draft = "L001: 古いテキスト\nL002: 変更されない行";
		const answer: Answer = {
			thinking: "テスト用の修正",
			patches: [{ type: "replace", line: 1, text: "新しいテキスト" }],
		};
		const result = applyPatch(draft, answer);
		expect(result).toContain("L001: 新しいテキスト");
		expect(result).toContain("L002: 変更されない行");
	});

	it("deleteパッチを適用する", () => {
		const draft = "L001: 削除される行\nL002: 残る行";
		const answer: Answer = {
			thinking: "行を削除",
			patches: [{ type: "delete", line: 1, text: null }],
		};
		const result = applyPatch(draft, answer);
		expect(result).not.toContain("削除される行");
		expect(result).toContain("L002: 残る行");
	});
});

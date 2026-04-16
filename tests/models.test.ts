import { describe, expect, it } from "vitest";
import { AnswerSchema, PatchSchema } from "../src/models.js";

describe("PatchSchema", () => {
	it("replace パッチを検証する", () => {
		const patch = PatchSchema.parse({ type: "replace", line: 3, text: "新しいテキスト" });
		expect(patch.type).toBe("replace");
		expect(patch.line).toBe(3);
		expect(patch.text).toBe("新しいテキスト");
	});

	it("delete パッチを検証する", () => {
		const patch = PatchSchema.parse({ type: "delete", line: 5, text: null });
		expect(patch.type).toBe("delete");
		expect(patch.line).toBe(5);
		expect(patch.text).toBeNull();
	});

	it("insert パッチを検証する", () => {
		const patch = PatchSchema.parse({ type: "insert", line: 1, text: "挿入テキスト" });
		expect(patch.type).toBe("insert");
		expect(patch.line).toBe(1);
		expect(patch.text).toBe("挿入テキスト");
	});

	it("不正なtypeでエラーになる", () => {
		expect(() => PatchSchema.parse({ type: "invalid", line: 1, text: "test" })).toThrow();
	});
});

describe("AnswerSchema", () => {
	it("Answerモデルを検証する", () => {
		const answer = AnswerSchema.parse({
			thinking: "修正の理由",
			patches: [
				{ type: "replace", line: 1, text: "修正テキスト" },
				{ type: "delete", line: 2, text: null },
			],
		});
		expect(answer.thinking).toBe("修正の理由");
		expect(answer.patches).toHaveLength(2);
		expect(answer.patches[0].type).toBe("replace");
		expect(answer.patches[1].type).toBe("delete");
	});
});

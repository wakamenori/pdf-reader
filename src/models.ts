import { z } from "zod/v4";

export const PatchSchema = z.object({
	type: z.enum(["replace", "delete", "insert"]).describe("パッチの種類。'replace' | 'delete' | 'insert'のいずれか。"),
	line: z.int().describe("対象行番号(例: L003なら3)。"),
	text: z.string().nullable().describe("置換するテキスト。typeが'replace' | 'insert'の場合のみ必要。"),
});

export type Patch = z.infer<typeof PatchSchema>;

export const AnswerSchema = z.object({
	thinking: z.string().describe("思考過程。ヘッダー・フッター、図の説明、表の整形などの修正方針を記述する。"),
	patches: z.array(PatchSchema),
});

export type Answer = z.infer<typeof AnswerSchema>;

export function getAnswerJsonSchema(): Record<string, unknown> {
	return z.toJSONSchema(AnswerSchema) as Record<string, unknown>;
}

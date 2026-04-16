import { readFileSync } from "node:fs";
import { type GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { z } from "zod/v4";
import { type Answer, AnswerSchema, getAnswerJsonSchema } from "./models.js";

function createGeminiClient(): GoogleGenAI {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not set in .env");
	}
	return new GoogleGenAI({ apiKey });
}

function calculateCost(response: GenerateContentResponse): number {
	const usageMetadata = response.usageMetadata;
	const inputTokens = usageMetadata?.promptTokenCount ?? 0;
	const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
	return (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;
}

const PROMPT = `
以下のMarkdownテキスト(行番号付き)と、その元になったページ画像をあたえます。
マークダウンテキストを画像と比較し、テキストが適切でない部分を探し、見つかれば修正を提案してください。

# Rules
1. 文字化されていない図をテキストデータとして追加する
   - mermaidで表現できる図（フローチャート、シーケンス図、状態遷移図、ER図、ガントチャート等）は \`\`\`mermaid コードブロックとして出力する
   - mermaidのノードラベルは必ずダブルクォートで囲む。括弧等の特殊文字がパースエラーを起こすため
   - mermaidの各ノード定義・接続は必ず1行で書く。ノード内にテキストの改行を入れないこと
   - mermaidのノード形状は以下のみ有効。開き括弧と閉じ括弧を正確に対応させること:
     四角: A["テキスト"]  角丸: A("テキスト")  ひし形: A{"テキスト"}  円柱: A[("テキスト")]  六角形: A{{"テキスト"}}
   - 悪い例: A[(テキスト] ← 閉じが )] でなく ] になっている。正しくは A[("テキスト")]
   - mermaidで表現できない図は<alt_image>タグで囲んだテキストデータとして追加する
        - <alt_image title="図のタイトル"> 図を説明するテキスト </alt_image>
   - 図のコンテキストを踏まえ、必要な部分だけテキスト化する
2. 表をMarkdownのパイプテーブルとして追加・整形する
    - 整形されていない元のテキストの行は完全に削除する
    - | ヘッダー1 | ヘッダー2 |\\n|---|---|\\n| データ1 | データ2 | のように整形する
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
`;

/**
 * 画像とDraft MarkdownをGeminiに送信し、パッチを取得し、LLM料金も返す。
 */
export async function getGeminiPatch(
	md: string,
	imagePath: string,
	modelName: string,
	maxRetries: number,
	retryBackoff: number,
): Promise<[Answer, number]> {
	const client = createGeminiClient();
	const imageData = readFileSync(imagePath);
	const base64Image = imageData.toString("base64");

	let lastException: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await client.models.generateContent({
				model: modelName,
				contents: [
					{
						role: "user",
						parts: [{ inlineData: { mimeType: "image/png", data: base64Image } }, { text: PROMPT }, { text: md }],
					},
				],
				config: {
					responseMimeType: "application/json",
					responseSchema: getAnswerJsonSchema(),
				},
			});

			const responseText = response.text;
			if (!responseText) {
				throw new Error("Gemini APIからレスポンステキストが取得できませんでした");
			}

			const parsed = JSON.parse(responseText);
			const answer = AnswerSchema.parse(parsed);
			console.log(JSON.stringify(answer, null, 2));

			return [answer, calculateCost(response)];
		} catch (e) {
			lastException = e as Error;
			const waitTime = retryBackoff * 2 ** (attempt - 1);
			console.log(`[Gemini] エラー発生(${attempt}回目): ${e}. ${waitTime}秒後にリトライします。`);
			await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
		}
	}

	throw new Error(`Gemini APIの呼び出しに${maxRetries}回失敗しました: ${lastException}`);
}

const MERMAID_FIX_PROMPT = `
以下のmermaidコードに構文エラーがあります。エラーメッセージを参考に修正してください。
修正したmermaidコードだけをfixedフィールドに返してください。
\`\`\`mermaid や \`\`\` の囲みは不要です。コードの中身だけを返してください。

# mermaid構文ルール
- ノードラベルは必ずダブルクォートで囲む
- 各ノード定義・接続は必ず1行で書く
- 有効なノード形状: 四角 A["text"]  角丸 A("text")  ひし形 A{"text"}  円柱 A[("text")]  六角形 A{{"text"}}
- 開き括弧と閉じ括弧を正確に対応させること
`;

const MermaidFixSchema = z.object({
	fixed: z.string().describe("修正後のmermaidコード"),
});

/**
 * mermaidコードとエラーメッセージをGeminiに送り、修正版を取得する。
 */
export async function fixMermaidWithGemini(
	mermaidCode: string,
	error: string,
	modelName: string,
	retryBackoff: number,
): Promise<[string, number]> {
	const client = createGeminiClient();
	const maxAttempts = 2;
	let lastException: Error | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await client.models.generateContent({
				model: modelName,
				contents: [
					{
						role: "user",
						parts: [
							{ text: MERMAID_FIX_PROMPT },
							{ text: `## mermaidコード\n${mermaidCode}` },
							{ text: `## エラーメッセージ\n${error}` },
						],
					},
				],
				config: {
					responseMimeType: "application/json",
					responseSchema: z.toJSONSchema(MermaidFixSchema) as Record<string, unknown>,
				},
			});

			const responseText = response.text;
			if (!responseText) {
				throw new Error("Gemini APIからレスポンステキストが取得できませんでした");
			}

			const parsed = MermaidFixSchema.parse(JSON.parse(responseText));

			return [parsed.fixed, calculateCost(response)];
		} catch (e) {
			lastException = e as Error;
			const waitTime = retryBackoff * 2 ** (attempt - 1);
			console.log(`[Mermaid Fix] API エラー(${attempt}回目): ${e}. ${waitTime}秒後にリトライします。`);
			await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
		}
	}

	throw new Error(`Mermaid修正のGemini API呼び出しに失敗しました: ${lastException}`);
}

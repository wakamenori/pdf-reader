import { execFile } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fixMermaidWithGemini } from "./gemini-client.js";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);

const MMDC_PATH = path.resolve("node_modules/.bin/mmdc");

export interface MermaidBlock {
	code: string;
	start: number;
	end: number;
}

/**
 * Markdownから ```mermaid ブロックを全て抽出する。
 * 行番号プレフィックス（L001: ）付きのケースにも対応する。
 */
export function extractMermaidBlocks(md: string): MermaidBlock[] {
	const blocks: MermaidBlock[] = [];
	// 行番号プレフィックス(L\d{3}: )があっても ```mermaid を検出する
	const regex = /(?:L\d{3}:\s?)?```mermaid\n([\s\S]*?)```/g;
	for (const match of md.matchAll(regex)) {
		blocks.push({
			code: match[1],
			start: match.index,
			end: match.index + match[0].length,
		});
	}
	return blocks;
}

/**
 * mermaidコードの末尾に改行がなければ追加する。
 * Geminiが閉じフェンスを最終行に連結するケース（`API1```）への対策。
 */
function ensureTrailingNewline(code: string): string {
	return code.endsWith("\n") ? code : `${code}\n`;
}

/**
 * mermaidコードをmmdcで検証する。
 */
export async function validateMermaid(code: string): Promise<{ valid: boolean; error: string | null }> {
	const tmpDir = path.join(tmpdir(), "pdf-reader-mermaid");
	mkdirSync(tmpDir, { recursive: true });
	const tmpFile = path.join(tmpDir, `validate-${Date.now()}-${Math.random().toString(36).slice(2)}.mmd`);
	const tmpOut = `${tmpFile}.svg`;

	try {
		writeFileSync(tmpFile, code, "utf-8");
		await execFileAsync(MMDC_PATH, ["-i", tmpFile, "-o", tmpOut], { timeout: 30_000 });
		return { valid: true, error: null };
	} catch (e) {
		const err = e as Error & { stderr?: string };
		const errorMsg = err.stderr || err.message;
		return { valid: false, error: errorMsg };
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {}
		try {
			unlinkSync(tmpOut);
		} catch {}
	}
}

/**
 * Markdown内の全mermaidブロックを検証し、エラーがあればGeminiで修正する。
 * 全リトライ失敗時は元のmermaidコードブロックをそのまま残す。
 */
export async function validateAndFixMermaid(
	md: string,
	modelName: string,
	maxRetries: number,
	retryBackoff: number,
): Promise<{ md: string; cost: number }> {
	const blocks = extractMermaidBlocks(md);
	if (blocks.length === 0) {
		return { md, cost: 0 };
	}

	let totalCost = 0;
	let result = md;

	// 後ろから置換することでインデックスがずれない
	for (let i = blocks.length - 1; i >= 0; i--) {
		const block = blocks[i];
		const normalizedCode = ensureTrailingNewline(block.code);
		const validation = await validateMermaid(normalizedCode);

		if (validation.valid) {
			// 改行が欠けていた場合は正規化した版で置換
			if (normalizedCode !== block.code) {
				const replacement = `\`\`\`mermaid\n${normalizedCode}\`\`\``;
				result = result.slice(0, block.start) + replacement + result.slice(block.end);
			}
			continue;
		}

		logger.debug(`[Mermaid] 構文エラー検出:\n${validation.error}`);

		let fixed: string | null = null;
		let currentCode = normalizedCode;
		let currentError = validation.error as string;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			logger.debug(`[Mermaid] Geminiで修正を試行 (${attempt}/${maxRetries})`);

			const [rawFixedCode, cost] = await fixMermaidWithGemini(currentCode, currentError, modelName, retryBackoff);
			totalCost += cost;
			const fixedCode = ensureTrailingNewline(rawFixedCode);

			const revalidation = await validateMermaid(fixedCode);
			if (revalidation.valid) {
				fixed = fixedCode;
				logger.debug(`[Mermaid] 修正成功 (${attempt}回目)`);
				break;
			}

			logger.debug(`[Mermaid] 修正後も構文エラー (${attempt}回目):\n${revalidation.error}`);
			currentCode = fixedCode;
			currentError = revalidation.error as string;
		}

		if (fixed) {
			const replacement = `\`\`\`mermaid\n${fixed}\`\`\``;
			result = result.slice(0, block.start) + replacement + result.slice(block.end);
		} else {
			logger.warn(`[Mermaid] ${maxRetries}回の修正に失敗。元のコードブロックのまま残します。`);
		}
	}

	return { md: result, cost: totalCost };
}

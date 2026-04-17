import chalk from "chalk";
import { diffLines } from "diff";
import { logger } from "./logger.js";
import type { Answer } from "./models.js";

/**
 * 行番号付きMarkdownから行番号→インデックスのマッピングを構築する。
 */
export function buildLineMap(mdLines: (string | null)[]): Map<number, number> {
	const lineMap = new Map<number, number>();
	for (let i = 0; i < mdLines.length; i++) {
		const mdLine = mdLines[i];
		if (mdLine) {
			const m = mdLine.match(/^L(\d{3}):/);
			if (m) {
				lineMap.set(Number.parseInt(m[1], 10), i);
			}
		}
	}
	return lineMap;
}

/**
 * 変更前後のテキストのカラー差分を生成する。
 */
export function colorDiff(before: string, after: string): string {
	const changes = diffLines(before, after);
	const result: string[] = [];
	for (const change of changes) {
		const lines = change.value.replace(/\n$/, "").split("\n");
		for (const line of lines) {
			if (change.added) {
				result.push(chalk.green(`+ ${line}`));
			} else if (change.removed) {
				result.push(chalk.red(`- ${line}`));
			} else {
				result.push(`  ${line}`);
			}
		}
	}
	return result.join("\n");
}

/**
 * Draft MarkdownにJSONパッチ(replace/delete/insert)を順に適用し、校正済みページMDを生成する。
 */
export function applyPatch(md: string, answer: Answer): string {
	const mdLines: (string | null)[] = md.split("\n");
	let lineMap = buildLineMap(mdLines);
	const beforeMd = mdLines.filter((line): line is string => line !== null).join("\n");

	for (const patch of answer.patches) {
		const patchType = patch.type;
		const patchLineNumber = patch.line;
		const text = patch.text;

		if (patchType === "replace") {
			const idx = lineMap.get(patchLineNumber);
			if (idx !== undefined) {
				const currentLine = mdLines[idx];
				if (currentLine !== null) {
					const prefix = currentLine.substring(0, 6); // "Lxxx: "
					mdLines[idx] = `${prefix}${text}`;
				}
			}
		} else if (patchType === "delete") {
			const idx = lineMap.get(patchLineNumber);
			if (idx !== undefined) {
				mdLines[idx] = null;
			}
		} else if (patchType === "insert") {
			// 新しい行番号は直後の最大+1
			let maxLineno = 0;
			for (const mdLine of mdLines) {
				if (mdLine) {
					const m2 = mdLine.match(/^L(\d{3}):/);
					if (m2) {
						maxLineno = Math.max(maxLineno, Number.parseInt(m2[1], 10));
					}
				}
			}
			const newLineno = maxLineno + 1;
			const newLine = `L${String(newLineno).padStart(3, "0")}: ${text}`;
			const insertIdx = lineMap.get(patchLineNumber);
			if (insertIdx !== undefined) {
				mdLines.splice(insertIdx + 1, 0, newLine);
			} else if (patchLineNumber === newLineno) {
				mdLines.push(newLine);
			}
			// line_mapを再構築
			lineMap = buildLineMap(mdLines);
		}
	}

	// None(DELETE)を除外
	const filteredLines = mdLines.filter((mdLine): mdLine is string => mdLine !== null);
	const afterMd = filteredLines.join("\n");

	logger.debug(`\n===== ページ全体の差分 =====\n${colorDiff(beforeMd, afterMd)}`);

	return afterMd;
}

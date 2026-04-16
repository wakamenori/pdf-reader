import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 校正版Markdownをページごとに保存する。
 */
export function storePage(fixedMd: string, pageNum: number, pagesDir: string): string {
	mkdirSync(pagesDir, { recursive: true });
	const mdPath = path.join(pagesDir, `page_${String(pageNum + 1).padStart(3, "0")}.md`);
	writeFileSync(mdPath, fixedMd, "utf-8");
	return mdPath;
}

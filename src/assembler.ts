import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 閉じられていないコードブロックを検出し、末尾に閉じタグを追加する。
 */
function fixUnclosedCodeBlocks(pageMd: string, pageNum: number): string {
	let openCount = 0;
	let closeCount = 0;
	for (const line of pageMd.split("\n")) {
		const stripped = line.trim();
		if (stripped.startsWith("```") && stripped.length > 3) {
			openCount++;
		} else if (stripped === "```") {
			closeCount++;
		}
	}
	if (openCount > closeCount) {
		const missing = openCount - closeCount;
		console.warn(`Page ${pageNum}: ${missing}個の閉じられていないコードブロックを検出。自動で閉じます。`);
		pageMd += "\n```".repeat(missing);
	}
	return pageMd;
}

/**
 * ページMDを番号順に連結し、2種類のMDファイルを生成する。
 * - 画像付きバージョン: ページ先頭に元のページ画像リンクを挿入
 * - ピュアMarkdownバージョン: テキストのみ
 */
export function assembleFinalMd(
	pageMdPaths: string[],
	runOutputDir: string,
	imagesDir: string,
	pdfFilename: string,
): [string, string] {
	const pagesWithImages: string[] = [];
	const pagesPure: string[] = [];

	for (let i = 0; i < pageMdPaths.length; i++) {
		const mdPath = pageMdPaths[i];
		const pageNum = i + 1;
		let pageMd = readFileSync(mdPath, "utf-8");

		// 行番号除去
		pageMd = pageMd.replace(/^L\d{3}:\s?/gm, "");

		// 閉じられていないコードブロックを修正
		pageMd = fixUnclosedCodeBlocks(pageMd, pageNum);

		pagesPure.push(`<!-- page ${pageNum} -->\n\n${pageMd.trim()}`);

		// ページ先頭に画像リンクを挿入したバージョン
		const imageName = `page_${String(pageNum).padStart(3, "0")}.png`;
		const imageRelPath = path.relative(runOutputDir, path.join(imagesDir, imageName));
		const pageWithImage = `![page ${pageNum}](${imageRelPath})\n\n${pageMd}`;
		pagesWithImages.push(pageWithImage.trim());
	}

	const basename = path.basename(pdfFilename, path.extname(pdfFilename));

	// 画像付きバージョン
	const finalWithImages = pagesWithImages.join("\n\n---\n\n");
	const withImagesPath = path.join(runOutputDir, `${basename}.md`);
	writeFileSync(withImagesPath, finalWithImages, "utf-8");

	// ピュアMarkdownバージョン
	const finalPure = pagesPure.join("\n\n---\n\n");
	const purePath = path.join(runOutputDir, `${basename}_pure.md`);
	writeFileSync(purePath, finalPure, "utf-8");

	return [withImagesPath, purePath];
}

import { mkdirSync } from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { assembleFinalMd } from "./assembler.js";
import { parseConfig } from "./config.js";
import { getGeminiPatch } from "./gemini-client.js";
import { initLogger, logger } from "./logger.js";
import { draftMarkdown } from "./markdown-drafter.js";
import { validateAndFixMermaid } from "./mermaid-validator.js";
import { storePage } from "./page-store.js";
import { applyPatch } from "./patch-applier.js";
import { rasterizePage } from "./rasterizer.js";
import { extractTextLines, getPageCount } from "./text-extractor.js";

function formatTimestamp(): string {
	const now = new Date();
	const y = now.getFullYear();
	const mo = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	const h = String(now.getHours()).padStart(2, "0");
	const mi = String(now.getMinutes()).padStart(2, "0");
	return `${y}${mo}${d}_${h}${mi}`;
}

async function main() {
	const config = parseConfig();
	const timestamp = formatTimestamp();

	// 中間生成物は /tmp/pdf-reader/<timestamp>/ に置く
	const runOutputDir = path.join("/tmp", "pdf-reader", timestamp);
	const pagesDir = path.join(runOutputDir, "pages");
	const imagesDir = path.join(runOutputDir, "images");
	mkdirSync(pagesDir, { recursive: true });
	mkdirSync(imagesDir, { recursive: true });

	// ログ初期化(中間生成物と同じdirへ)
	initLogger(runOutputDir, config.logLevel);
	logger.info(`Started processing: ${config.pdfPath}`);
	logger.info(`Intermediate dir: ${runOutputDir}`);

	// PDFページ数取得
	const numPages = await getPageCount(config.pdfPath);
	logger.info(`Total pages: ${numPages}`);

	// 再開ページ番号(1始まり→0始まりに変換)
	const resumeFrom = Math.max(config.resumeFrom - 1, 0);
	const totalToProcess = numPages - resumeFrom;
	let completed = 0;

	// Page Worker 処理
	async function processPage(pageNum: number): Promise<[string, number]> {
		logger.debug(`Started page ${pageNum + 1}`);

		// 1. テキスト抽出
		const draftMd = await extractTextLines(config.pdfPath, pageNum);
		// 2. Markdown整形
		const md = draftMarkdown(draftMd);
		// 3. 画像生成
		const imagePath = await rasterizePage(config.pdfPath, pageNum, config.dpi, imagesDir);
		// 4. Geminiパッチ取得
		const [answer, patchCost] = await getGeminiPatch(
			md,
			imagePath,
			config.geminiModel,
			config.maxRetries,
			config.retryBackoff,
		);
		logger.debug(`Gemini patch cost: $${patchCost.toFixed(4)}`);
		// 5. パッチ適用
		const fixedMd = applyPatch(md, answer);
		// 5.5 mermaid検証・修正
		const { md: validatedMd, cost: mermaidCost } = await validateAndFixMermaid(
			fixedMd,
			config.geminiModel,
			config.mermaidMaxRetries,
			config.retryBackoff,
		);
		const price = patchCost + mermaidCost;
		// 6. ページ保存
		const pageMdPath = storePage(validatedMd, pageNum, pagesDir);
		completed++;
		logger.info(`Finished page ${pageNum + 1} (${completed}/${totalToProcess})`);

		return [pageMdPath, price];
	}

	// 並列実行
	const limit = pLimit(config.workers);
	const pages = Array.from({ length: numPages - resumeFrom }, (_, i) => i + resumeFrom);
	const results = await Promise.all(pages.map((pageNum) => limit(() => processPage(pageNum))));

	let totalPrice = 0;
	const pageMdPaths: string[] = [];
	for (const [pageMdPath, price] of results) {
		pageMdPaths.push(pageMdPath);
		totalPrice += price;
	}

	logger.info(`Total cost: $${totalPrice.toFixed(4)}`);

	// ページ順に並べ替え
	pageMdPaths.sort();

	// アセンブル(入力PDFと同じdirへ書き出す)
	const { purePath, withImagesPath } = assembleFinalMd({
		pageMdPaths,
		imagesDir,
		pdfPath: config.pdfPath,
		withImages: config.withImages,
	});
	logger.info(`Output: ${purePath}`);
	if (withImagesPath) {
		logger.info(`Output (with images): ${withImagesPath}`);
	}
}

main().catch((err) => {
	logger.error(`Fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
	process.exit(1);
});

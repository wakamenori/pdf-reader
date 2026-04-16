import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { assembleFinalMd } from "./assembler.js";
import { parseConfig } from "./config.js";
import { getGeminiPatch } from "./gemini-client.js";
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

function createLogger(logDir: string, timestamp: string) {
	mkdirSync(logDir, { recursive: true });
	const logFile = path.join(logDir, `run_${timestamp}.log`);
	writeFileSync(logFile, "", "utf-8");

	return {
		info(message: string) {
			const line = `[${new Date().toISOString()}] INFO - ${message}`;
			console.log(line);
			appendFileSync(logFile, `${line}\n`, "utf-8");
		},
		warn(message: string) {
			const line = `[${new Date().toISOString()}] WARN - ${message}`;
			console.warn(line);
			appendFileSync(logFile, `${line}\n`, "utf-8");
		},
		error(message: string) {
			const line = `[${new Date().toISOString()}] ERROR - ${message}`;
			console.error(line);
			appendFileSync(logFile, `${line}\n`, "utf-8");
		},
	};
}

async function main() {
	const config = parseConfig();
	const timestamp = formatTimestamp();

	// タイムスタンプ付き出力ディレクトリ
	const runOutputDir = path.join(config.outputDir, timestamp);
	const pagesDir = path.join(runOutputDir, "pages");
	const imagesDir = path.join(runOutputDir, "images");
	mkdirSync(pagesDir, { recursive: true });
	mkdirSync(imagesDir, { recursive: true });

	// ログ初期化
	const logger = createLogger("logs", timestamp);
	logger.info(`Started processing: ${config.pdfPath}`);

	// PDFページ数取得
	const numPages = await getPageCount(config.pdfPath);
	logger.info(`Total pages: ${numPages}`);

	// 再開ページ番号(1始まり→0始まりに変換)
	const resumeFrom = Math.max(config.resumeFrom - 1, 0);

	// Page Worker 処理
	async function processPage(pageNum: number): Promise<[string, number]> {
		logger.info(`Started page ${pageNum + 1}`);

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
		logger.info(`Gemini patch cost: $${patchCost.toFixed(4)}`);
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
		logger.info(`Finished page ${pageNum + 1}`);

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

	// アセンブル
	const [withImagesPath, purePath] = assembleFinalMd(pageMdPaths, runOutputDir, imagesDir, config.pdfPath);
	logger.info(`Output (with images): ${withImagesPath}`);
	logger.info(`Output (pure markdown): ${purePath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

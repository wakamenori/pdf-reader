import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
 * 同名ファイルを避けて連番(_2, _3, ...)を付与したパスを返す。
 */
function uniquePath(dir: string, basename: string, suffix: string): string {
	let candidate = path.join(dir, `${basename}${suffix}`);
	if (!existsSync(candidate)) return candidate;
	let i = 2;
	while (true) {
		candidate = path.join(dir, `${basename}_${i}${suffix}`);
		if (!existsSync(candidate)) return candidate;
		i++;
	}
}

/**
 * 同名dirを避けて連番付与したパスを返す。
 */
function uniqueDirPath(dir: string, name: string): string {
	let candidate = path.join(dir, name);
	if (!existsSync(candidate)) return candidate;
	let i = 2;
	while (true) {
		candidate = path.join(dir, `${name}_${i}`);
		if (!existsSync(candidate)) return candidate;
		i++;
	}
}

export interface AssembleOptions {
	pageMdPaths: string[];
	imagesDir: string;
	pdfPath: string;
	withImages: boolean;
}

export interface AssembleResult {
	purePath: string;
	withImagesPath: string | null;
}

/**
 * ページMDを番号順に連結し、入力PDFと同じdirへ書き出す。
 * - デフォルト: pure MD のみ (`<basename>.md`)
 * - withImages 指定時: 加えて `<basename>.with-images.md` と `<basename>_images/` を出力
 */
export function assembleFinalMd(opts: AssembleOptions): AssembleResult {
	const { pageMdPaths, imagesDir, pdfPath, withImages } = opts;

	const outputDir = path.dirname(path.resolve(pdfPath));
	const basename = path.basename(pdfPath, path.extname(pdfPath));

	const pagesPure: string[] = [];
	const pagesWithImages: string[] = [];

	// withImages の場合は画像コピー先 dir を準備
	let imagesOutDir: string | null = null;
	let imagesOutDirName: string | null = null;
	if (withImages) {
		imagesOutDir = uniqueDirPath(outputDir, `${basename}_images`);
		imagesOutDirName = path.basename(imagesOutDir);
		mkdirSync(imagesOutDir, { recursive: true });
	}

	for (let i = 0; i < pageMdPaths.length; i++) {
		const mdPath = pageMdPaths[i];
		const pageNum = i + 1;
		let pageMd = readFileSync(mdPath, "utf-8");

		// 行番号除去
		pageMd = pageMd.replace(/^L\d{3}:\s?/gm, "");
		// 閉じられていないコードブロックを修正
		pageMd = fixUnclosedCodeBlocks(pageMd, pageNum);

		pagesPure.push(`<!-- page ${pageNum} -->\n\n${pageMd.trim()}`);

		if (withImages && imagesOutDirName) {
			const imageName = `page_${String(pageNum).padStart(3, "0")}.png`;
			const imageRelPath = `${imagesOutDirName}/${imageName}`;
			pagesWithImages.push(`![page ${pageNum}](${imageRelPath})\n\n${pageMd}`.trim());
		}
	}

	// 画像コピー
	if (withImages && imagesOutDir) {
		for (const file of readdirSync(imagesDir)) {
			copyFileSync(path.join(imagesDir, file), path.join(imagesOutDir, file));
		}
	}

	// pure MD 書き出し
	const purePath = uniquePath(outputDir, basename, ".md");
	writeFileSync(purePath, pagesPure.join("\n\n---\n\n"), "utf-8");

	let withImagesPath: string | null = null;
	if (withImages) {
		withImagesPath = uniquePath(outputDir, basename, ".with-images.md");
		writeFileSync(withImagesPath, pagesWithImages.join("\n\n---\n\n"), "utf-8");
	}

	return { purePath, withImagesPath };
}

import { mkdirSync } from "node:fs";
import path from "node:path";
import { Poppler } from "node-poppler";

/**
 * 指定したPDFページをPNG画像として保存する。
 */
export async function rasterizePage(pdfPath: string, pageNum: number, dpi: number, imagesDir: string): Promise<string> {
	mkdirSync(imagesDir, { recursive: true });

	const poppler = new Poppler();
	const imageName = `page_${String(pageNum + 1).padStart(3, "0")}`;
	const outputPath = path.join(imagesDir, imageName);

	await poppler.pdfToPpm(pdfPath, outputPath, {
		firstPageToConvert: pageNum + 1,
		lastPageToConvert: pageNum + 1,
		pngFile: true,
		resolutionXYAxis: dpi,
		singleFile: true,
	});

	return `${outputPath}.png`;
}

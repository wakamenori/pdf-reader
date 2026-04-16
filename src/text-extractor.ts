import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

/**
 * 指定したPDFページから行番号付きテキスト(L001: ...)を抽出する。
 */
export async function extractTextLines(pdfPath: string, pageNum: number): Promise<string> {
	const doc = await getDocument(pdfPath).promise;
	const page = await doc.getPage(pageNum + 1); // pdfjs-distは1始まり
	const textContent = await page.getTextContent();

	// テキストアイテムから行を構築
	// Y座標でグループ化して行を形成する
	const items = textContent.items.filter((item): item is TextItem => "str" in item);

	if (items.length === 0) {
		await doc.destroy();
		return "L000: (EMPTY)";
	}

	// Y座標でソート（上から下へ）してグループ化
	const lineGroups = new Map<number, TextItem[]>();
	const tolerance = 2; // Y座標の許容誤差

	for (const item of items) {
		const y = Math.round(item.transform[5] / tolerance) * tolerance;
		const existing = lineGroups.get(y);
		if (existing) {
			existing.push(item);
		} else {
			lineGroups.set(y, [item]);
		}
	}

	// Y座標降順（ページ上部から下部へ）にソート
	const sortedYs = [...lineGroups.keys()].sort((a, b) => b - a);

	const mdLines: string[] = [];
	for (let i = 0; i < sortedYs.length; i++) {
		const y = sortedYs[i];
		const groupItems = lineGroups.get(y);
		if (!groupItems) continue;
		// X座標順にソート
		groupItems.sort((a, b) => a.transform[4] - b.transform[4]);
		const lineText = groupItems.map((item) => item.str).join("");
		if (lineText.trim()) {
			mdLines.push(`L${String(mdLines.length + 1).padStart(3, "0")}: ${lineText}`);
		}
	}

	await doc.destroy();

	if (mdLines.length === 0) {
		return "L000: (EMPTY)";
	}

	return mdLines.join("\n");
}

/**
 * PDFの総ページ数を取得する。
 */
export async function getPageCount(pdfPath: string): Promise<number> {
	const doc = await getDocument(pdfPath).promise;
	const numPages = doc.numPages;
	await doc.destroy();
	return numPages;
}

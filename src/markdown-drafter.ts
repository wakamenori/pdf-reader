/**
 * 行番号付きDraft Markdownを、箇条書き・見出し・簡易表をMarkdown記法に整形する。
 */
export function draftMarkdown(draftMd: string): string {
	const lines = draftMd.split("\n");
	const mdLines: string[] = [];

	for (const line of lines) {
		const m = line.match(/^(L\d{3}:\s)(.*)$/);
		if (!m) {
			mdLines.push(line);
			continue;
		}
		const prefix = m[1];
		let content = m[2];

		// 箇条書き
		if (/^[・\-•]\s+/.test(content)) {
			content = `- ${content.substring(2).trimStart()}`;
		}
		// 見出し(例: "第1章", "1.", "1.", "1 " で始まる)
		else if (/^(第?\d+章|[0-9]+[.．\s])/.test(content)) {
			content = `# ${content}`;
		}
		// 簡易表(タブ区切り or 全角スペース区切りが2つ以上)
		else if (content.includes("\t") || /　{2,}/.test(content)) {
			content = `| ${content.replace(/(\t|　{2,})/g, " | ")} |`;
		}

		mdLines.push(prefix + content);
	}

	return mdLines.join("\n");
}

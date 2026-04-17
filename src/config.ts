import { readFileSync } from "node:fs";
import { Command } from "commander";
import dotenv from "dotenv";
import YAML from "yaml";

import type { LogLevel } from "./logger.js";

export interface AppConfig {
	pdfPath: string;
	workers: number;
	dpi: number;
	geminiModel: string;
	maxRetries: number;
	retryBackoff: number;
	logLevel: LogLevel;
	resumeFrom: number;
	mermaidMaxRetries: number;
	withImages: boolean;
}

function normalizeLogLevel(value: string | undefined): LogLevel {
	const lower = (value ?? "info").toLowerCase();
	if (lower === "debug" || lower === "info" || lower === "warn" || lower === "error") {
		return lower;
	}
	return "info";
}

interface YamlConfig {
	dpi?: number;
	workers?: number;
	gemini_model?: string;
	max_retries?: number;
	retry_backoff?: number;
	log_level?: string;
	mermaid_max_retries?: number;
}

function loadYamlConfig(configPath: string): YamlConfig {
	const content = readFileSync(configPath, "utf-8");
	return YAML.parse(content) as YamlConfig;
}

export function parseConfig(): AppConfig {
	dotenv.config();

	const program = new Command();
	program
		.name("pdf-reader")
		.description("PDF → Markdown 変換パイプライン")
		.argument("<pdf_path>", "入力PDFファイルパス")
		.option("--config <path>", "設定ファイルパス", "configs/config.yaml")
		.option("--workers <number>", "並列ワーカー数", Number.parseInt)
		.option("--dpi <number>", "画像DPI", Number.parseInt)
		.option("--resume-from <number>", "このページ番号から再開(1始まり)", Number.parseInt, 1)
		.option("--with-images", "ページ画像付きの .with-images.md も出力する", false)
		.option("--verbose", "diff や Gemini レスポンスなど詳細ログを console に出す", false)
		.parse();

	const args = program.opts<{
		config: string;
		workers?: number;
		dpi?: number;
		resumeFrom: number;
		withImages: boolean;
		verbose: boolean;
	}>();
	const pdfPath = program.args[0];

	const yamlConfig = loadYamlConfig(args.config);

	return {
		pdfPath,
		workers: args.workers ?? yamlConfig.workers ?? 4,
		dpi: args.dpi ?? yamlConfig.dpi ?? 300,
		geminiModel: yamlConfig.gemini_model ?? "gemini-3.1-flash-lite-preview",
		maxRetries: yamlConfig.max_retries ?? 3,
		retryBackoff: yamlConfig.retry_backoff ?? 2,
		logLevel: args.verbose ? "debug" : normalizeLogLevel(yamlConfig.log_level),
		resumeFrom: args.resumeFrom,
		mermaidMaxRetries: yamlConfig.mermaid_max_retries ?? 2,
		withImages: args.withImages,
	};
}

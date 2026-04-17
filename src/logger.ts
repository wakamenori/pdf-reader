import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let consoleLevel: LogLevel = "info";
let logFile: string | null = null;

export function initLogger(logDir: string, level: LogLevel = "info"): void {
	mkdirSync(logDir, { recursive: true });
	logFile = path.join(logDir, "run.log");
	writeFileSync(logFile, "", "utf-8");
	consoleLevel = level;
}

function emit(level: LogLevel, message: string, toConsole: (s: string) => void): void {
	const line = `[${new Date().toISOString()}] ${level.toUpperCase()} - ${message}`;
	if (logFile) {
		appendFileSync(logFile, `${line}\n`, "utf-8");
	}
	if (LEVEL_ORDER[level] >= LEVEL_ORDER[consoleLevel]) {
		toConsole(line);
	}
}

export const logger = {
	debug(message: string) {
		emit("debug", message, console.log);
	},
	info(message: string) {
		emit("info", message, console.log);
	},
	warn(message: string) {
		emit("warn", message, console.warn);
	},
	error(message: string) {
		emit("error", message, console.error);
	},
};

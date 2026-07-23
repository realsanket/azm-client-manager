import type { AzmClient } from "@/hooks/useAzm";

export interface ParsedOutput {
  body: string;
  metadata: Array<{ label: string; value: string }>;
  running?: string;
}

function isRule(line: string) {
  return /^[\s─═-]{8,}$/.test(line.trim());
}

export function parseAzmOutput(output: string): ParsedOutput {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  const metadata: ParsedOutput["metadata"] = [];
  let cursor = 0;

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  if (isRule(lines[cursor] ?? "")) {
    cursor += 1;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isRule(line)) {
        cursor += 1;
        break;
      }
      const match = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/);
      if (match) {
        metadata.push({ label: match[1], value: match[2] || "not set" });
      } else if (line.trim()) {
        break;
      }
      cursor += 1;
    }
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  let running: string | undefined;
  const runningMatch = lines[cursor]?.match(/^\s*▸\s*Running:\s*(.*)$/);
  if (runningMatch) {
    running = runningMatch[1];
    cursor += 1;
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  return {
    body: lines.slice(cursor).join("\n").trimEnd(),
    metadata,
    running,
  };
}

export function lineCount(value: string) {
  if (!value.trim()) return 0;
  return value.trimEnd().split("\n").length;
}

export function isAzCommand(value: string) {
  return /^az\s+/i.test(value.trim());
}

export type TokenState = "valid" | "expired" | "cached" | "missing";

export function tokenState(
  client: AzmClient,
  tokenValid: boolean | undefined
): TokenState {
  if (tokenValid === true) return "valid";
  if (tokenValid === false) return "expired";
  if (client.logged_in) return "cached";
  return "missing";
}

export function tokenLabel(state: TokenState) {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

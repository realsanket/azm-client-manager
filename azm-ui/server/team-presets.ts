import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

export interface TeamRecipe {
  label: string;
  command: string;
}

export interface TeamPresetDefinition {
  id: string;
  name: string;
  description?: string;
  sourceFile: string;
  recipes: {
    command: TeamRecipe[];
  };
}

export interface TeamPresetIndex {
  directory: string;
  presets: TeamPresetDefinition[];
  errors: string[];
}

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, "..", "..");
const PRESETS_DIR = path.join(REPO_ROOT, "team-presets");
const YAML_EXTENSIONS = new Set([".yml", ".yaml"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizePresetId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized.replace(/^_+|_+$/g, "") || "team_preset";
}

function parseRecipes(value: unknown, fileName: string): TeamRecipe[] {
  if (!Array.isArray(value)) {
    throw new Error(`Missing recipes.command array in ${fileName}`);
  }

  const parsed: TeamRecipe[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const label = asString(record?.label);
    const command = asString(record?.command);

    if (!label || !command) {
      throw new Error(`Each recipes.command item requires non-empty label and command in ${fileName}`);
    }

    parsed.push({ label, command });
  }

  if (parsed.length === 0) {
    throw new Error(`recipes.command must include at least one recipe in ${fileName}`);
  }

  return parsed;
}

function parsePresetFromFile(fileName: string, source: string): TeamPresetDefinition {
  const yamlRoot = asRecord(load(source));
  if (!yamlRoot) {
    throw new Error(`YAML root must be an object in ${fileName}`);
  }

  const baseId = path.basename(fileName, path.extname(fileName));
  const id = normalizePresetId(asString(yamlRoot.id) ?? baseId);
  const name = asString(yamlRoot.name) ?? baseId;
  const description = asString(yamlRoot.description);

  const recipesRoot = asRecord(yamlRoot.recipes);
  const commandRaw = recipesRoot?.command ?? yamlRoot.command;

  return {
    id,
    name,
    description,
    sourceFile: fileName,
    recipes: {
      command: parseRecipes(commandRaw, fileName),
    },
  };
}

export async function listTeamPresets(): Promise<TeamPresetIndex> {
  const result: TeamPresetIndex = {
    directory: PRESETS_DIR,
    presets: [],
    errors: [],
  };

  let entries;
  try {
    entries = await fs.readdir(PRESETS_DIR, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      result.errors.push(`Preset directory not found: ${PRESETS_DIR}`);
      return result;
    }
    throw error;
  }

  const yamlFiles = entries
    .filter((entry) => entry.isFile() && YAML_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of yamlFiles) {
    const absolutePath = path.join(PRESETS_DIR, fileName);
    try {
      const source = await fs.readFile(absolutePath, "utf-8");
      result.presets.push(parsePresetFromFile(fileName, source));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`${fileName}: ${message}`);
    }
  }

  result.presets.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

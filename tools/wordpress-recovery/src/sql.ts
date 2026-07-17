import { readSqlInput } from "./input.js";
import {
  ParsedWordPressDump,
  SqlRecord,
  SqlScalar,
  WORDPRESS_TABLE_SUFFIXES,
  WordPressTableSuffix,
} from "./types.js";

export type ParseOptions = {
  prefix?: string;
  /** Extra table suffixes to parse beyond core WordPress tables (e.g. aawp_products). */
  extraTableSuffixes?: string[];
};

const CREATE_TABLE_RE = /CREATE TABLE `([^`]+)`/g;
const INSERT_RE = /^INSERT INTO `(?:[^`]+`\.)?`?([^`]+)`?\s*\(([\s\S]*?)\)\s*VALUES\s*/;

export function parseWordPressDump(path: string, options: ParseOptions = {}): ParsedWordPressDump {
  const input = readSqlInput(path);
  const tables = getCreatedTables(input.sql);
  const tablePrefix = options.prefix ?? detectTablePrefix(tables);
  const allowedTables = new Map<string, WordPressTableSuffix>();

  for (const suffix of WORDPRESS_TABLE_SUFFIXES) {
    allowedTables.set(`${tablePrefix}${suffix}`, suffix);
  }

  const records = createEmptyRecords();
  const extraRecords: Record<string, SqlRecord[]> = {};
  const extraTables = new Map<string, string>();

  for (const suffix of options.extraTableSuffixes ?? []) {
    extraTables.set(`${tablePrefix}${suffix}`, suffix);
    extraRecords[suffix] = [];
  }

  for (const statement of iterateInsertStatements(input.sql)) {
    const parsed = parseInsertStatement(statement);
    if (!parsed) {
      continue;
    }

    const suffix = allowedTables.get(parsed.table);
    if (suffix) {
      records[suffix].push(...parsed.rows.map((row) => rowToRecord(parsed.columns, row)));
      continue;
    }

    const extraSuffix = extraTables.get(parsed.table);
    if (extraSuffix) {
      extraRecords[extraSuffix].push(...parsed.rows.map((row) => rowToRecord(parsed.columns, row)));
    }
  }

  return {
    sourcePath: path,
    inputFormat: input.format,
    databaseName: getDatabaseName(input.sql),
    tablePrefix,
    tables,
    records,
    extraRecords,
  };
}

export function detectTablePrefix(tables: string[]): string {
  const scores = new Map<string, number>();

  for (const table of tables) {
    for (const suffix of WORDPRESS_TABLE_SUFFIXES) {
      const expectedEnding = `_${suffix}`;
      if (table.endsWith(expectedEnding)) {
        const prefix = table.slice(0, -suffix.length);
        scores.set(prefix, (scores.get(prefix) ?? 0) + 1);
      }
    }
  }

  const [best] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (!best) {
    throw new Error("Could not detect a WordPress table prefix from CREATE TABLE statements.");
  }

  return best;
}

export function parseInsertStatement(
  statement: string,
): { table: string; columns: string[]; rows: SqlScalar[][] } | null {
  const match = statement.match(INSERT_RE);
  if (!match) {
    return null;
  }

  const valuesStart = match[0].length;
  const valuesSql = statement.slice(valuesStart).replace(/;\s*$/, "");

  return {
    table: match[1],
    columns: parseColumnList(match[2]),
    rows: parseValues(valuesSql),
  };
}

export function parseValues(valuesSql: string): SqlScalar[][] {
  const rows: SqlScalar[][] = [];
  let index = 0;

  while (index < valuesSql.length) {
    while (index < valuesSql.length && valuesSql[index] !== "(") {
      index += 1;
    }

    if (index >= valuesSql.length) {
      break;
    }

    index += 1;
    const row: SqlScalar[] = [];

    while (index < valuesSql.length) {
      while (index < valuesSql.length && /\s/.test(valuesSql[index])) {
        index += 1;
      }

      if (valuesSql[index] === "'") {
        const parsed = parseQuotedString(valuesSql, index);
        row.push(parsed.value);
        index = parsed.nextIndex;
      } else {
        const start = index;
        while (index < valuesSql.length && valuesSql[index] !== "," && valuesSql[index] !== ")") {
          index += 1;
        }
        const token = valuesSql.slice(start, index).trim();
        row.push(token.toUpperCase() === "NULL" ? null : token);
      }

      while (index < valuesSql.length && /\s/.test(valuesSql[index])) {
        index += 1;
      }

      if (valuesSql[index] === ",") {
        index += 1;
        continue;
      }

      if (valuesSql[index] === ")") {
        index += 1;
        rows.push(row);
        break;
      }
    }
  }

  return rows;
}

function getCreatedTables(sql: string): string[] {
  return [...sql.matchAll(CREATE_TABLE_RE)].map((match) => match[1]);
}

function getDatabaseName(sql: string): string | undefined {
  const databaseMatch = sql.match(/^-- Database:\s+`([^`]+)`/m);
  return databaseMatch?.[1];
}

function createEmptyRecords(): Record<WordPressTableSuffix, SqlRecord[]> {
  return {
    posts: [],
    postmeta: [],
    terms: [],
    term_taxonomy: [],
    term_relationships: [],
    users: [],
    usermeta: [],
    options: [],
  };
}

function* iterateInsertStatements(sql: string): Generator<string> {
  let collecting = false;
  let statement = "";

  for (const line of sql.split(/\r?\n/)) {
    if (!collecting && !line.trimStart().startsWith("INSERT INTO")) {
      continue;
    }

    collecting = true;
    statement += `${line}\n`;

    if (line.trimEnd().endsWith(";")) {
      yield statement;
      collecting = false;
      statement = "";
    }
  }
}

function parseColumnList(columnsSql: string): string[] {
  return columnsSql
    .split(",")
    .map((column) => column.trim().replace(/^`|`$/g, ""));
}

function parseQuotedString(sql: string, startIndex: number): { value: string; nextIndex: number } {
  let index = startIndex + 1;
  let value = "";

  while (index < sql.length) {
    const char = sql[index];

    if (char === "'") {
      return { value, nextIndex: index + 1 };
    }

    if (char === "\\" && index + 1 < sql.length) {
      const escaped = sql[index + 1];
      value += unescapeMySqlChar(escaped);
      index += 2;
      continue;
    }

    value += char;
    index += 1;
  }

  throw new Error("Unterminated SQL string literal while parsing INSERT values.");
}

function unescapeMySqlChar(char: string): string {
  switch (char) {
    case "0":
      return "\0";
    case "b":
      return "\b";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "Z":
      return "\x1a";
    default:
      return char;
  }
}

function rowToRecord(columns: string[], row: SqlScalar[]): SqlRecord {
  return Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null]));
}

import { inflateRawSync, gunzipSync } from "node:zlib";
import { extname } from "node:path";
import { readFileSync } from "node:fs";

export type SqlInput = {
  sql: string;
  format: "sql" | "sql.gz" | "zip";
  memberName?: string;
};

export function readSqlInput(path: string): SqlInput {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".sql.gz")) {
    return {
      sql: gunzipSync(readFileSync(path)).toString("utf8"),
      format: "sql.gz",
    };
  }

  if (lowerPath.endsWith(".zip")) {
    const member = readFirstSqlFromZip(readFileSync(path));
    return {
      sql: member.sql,
      format: "zip",
      memberName: member.name,
    };
  }

  if (extname(lowerPath) === ".sql") {
    return {
      sql: readFileSync(path, "utf8"),
      format: "sql",
    };
  }

  throw new Error(`Unsupported input format for ${path}. Expected .sql, .sql.gz, or .zip.`);
}

function readFirstSqlFromZip(buffer: Buffer): { name: string; sql: string } {
  const endOfCentralDirectory = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOfCentralDirectory + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectory + 16);

  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry.");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    if (fileName.toLowerCase().endsWith(".sql")) {
      return {
        name: fileName,
        sql: readZipMember(buffer, localHeaderOffset, compressedSize, compressionMethod).toString("utf8"),
      };
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("ZIP archive does not contain a .sql file.");
}

function readZipMember(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  compressionMethod: number,
): Buffer {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Invalid ZIP local file header.");
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    return compressed;
  }

  if (compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`Unsupported ZIP compression method ${compressionMethod}.`);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minimumSize = 22;
  const maxCommentLength = 0xffff;
  const start = Math.max(0, buffer.length - minimumSize - maxCommentLength);

  for (let cursor = buffer.length - minimumSize; cursor >= start; cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === signature) {
      return cursor;
    }
  }

  throw new Error("Invalid ZIP archive: end of central directory not found.");
}

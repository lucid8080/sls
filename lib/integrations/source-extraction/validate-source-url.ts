import { isIP } from "node:net";
import { TopicDomainError } from "@/lib/cms/topics/errors";

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".home",
  ".lan",
  ".corp",
];

function parseIpv4(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split(".").map(Number);
}

function parseIpv6(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  const [leftRaw, rightRaw = ""] = address.split("::");
  const convert = (side: string) => {
    const parts = side ? side.split(":") : [];
    const last = parts.at(-1);
    if (last?.includes(".")) {
      const ipv4 = parseIpv4(last);
      if (!ipv4) return null;
      parts.splice(
        -1,
        1,
        ((ipv4[0] << 8) | ipv4[1]).toString(16),
        ((ipv4[2] << 8) | ipv4[3]).toString(16),
      );
    }
    return parts;
  };
  const left = convert(leftRaw);
  const right = convert(rightRaw);
  if (!left || !right) return null;
  const hasCompression = address.includes("::");
  const missing = 8 - left.length - right.length;
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const values = groups.map((part) => Number.parseInt(part || "0", 16));
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 0xffff)) {
    return null;
  }
  return values.flatMap((value) => [value >> 8, value & 0xff]);
}

export function isPrivateOrReservedIp(input: string): boolean {
  const address = input.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const v4 = parseIpv4(address);

  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  const bytes = parseIpv6(address);
  if (!bytes) return true;
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const mappedV4 =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  if (mappedV4) {
    return isPrivateOrReservedIp(bytes.slice(12).join("."));
  }
  return (
    allZero ||
    loopback ||
    (bytes[0] & 0xfe) === 0xfc ||
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) ||
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) ||
    bytes[0] === 0xff ||
    (bytes[0] === 0x20 &&
      bytes[1] === 0x01 &&
      bytes[2] === 0x0d &&
      bytes[3] === 0xb8)
  );
}

export function parseSourceUrl(input: string): URL {
  if (!input.trim() || input.trim().length > 2048) {
    throw new TopicDomainError(
      "SOURCE_URL_UNSAFE",
      "Enter a valid public URL no longer than 2048 characters.",
    );
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new TopicDomainError("SOURCE_URL_UNSAFE", "Enter a valid public URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TopicDomainError(
      "SOURCE_URL_UNSAFE",
      "Only HTTP and HTTPS source URLs are allowed.",
    );
  }
  if (url.username || url.password) {
    throw new TopicDomainError(
      "SOURCE_URL_UNSAFE",
      "Source URLs containing credentials are not allowed.",
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    (!hostname.includes(".") && isIP(hostname) === 0) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (isIP(hostname) > 0 && isPrivateOrReservedIp(hostname))
  ) {
    throw new TopicDomainError(
      "SOURCE_URL_UNSAFE",
      "This URL does not point to a public internet host.",
    );
  }

  return url;
}

export function assertPublicResolvedAddresses(addresses: string[]): void {
  if (!addresses.length || addresses.some(isPrivateOrReservedIp)) {
    throw new TopicDomainError(
      "SOURCE_URL_UNSAFE",
      "The source hostname resolved to a non-public address.",
    );
  }
}

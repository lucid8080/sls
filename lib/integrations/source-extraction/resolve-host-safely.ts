import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import type { ResolvedPublicAddress } from "./types";
import {
  assertPublicResolvedAddresses,
  isPrivateOrReservedIp,
} from "./validate-source-url";

export type HostLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: HostLookup = async (hostname) => {
  const rows = await dnsLookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({ address: row.address, family: row.family }));
};

export async function resolveHostSafely(
  hostnameInput: string,
  lookup: HostLookup = defaultLookup,
): Promise<ResolvedPublicAddress[]> {
  const hostname = hostnameInput.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new TopicDomainError(
        "SOURCE_URL_UNSAFE",
        "The source URL uses a non-public address.",
      );
    }
    return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  }

  let rows: Array<{ address: string; family: number }>;
  try {
    rows = await lookup(hostname);
  } catch {
    throw new TopicDomainError(
      "SOURCE_FETCH_FAILED",
      "The source hostname could not be resolved.",
    );
  }

  const validRows = rows.filter(
    (row): row is ResolvedPublicAddress =>
      (row.family === 4 || row.family === 6) && isIP(row.address) === row.family,
  );
  assertPublicResolvedAddresses(validRows.map((row) => row.address));

  return [...new Map(validRows.map((row) => [`${row.family}:${row.address}`, row])).values()];
}

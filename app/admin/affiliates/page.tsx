"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type AffiliateArticle = {
  articleId: string;
  articleTitle: string;
  pathname: string;
  articleSource: "database" | "recovered" | "catalog";
  anchorText: string | null;
};

type AffiliateLink = {
  id: string;
  url: string;
  normalizedUrl: string;
  network: "amazon" | "other";
  asin: string | null;
  affiliateTag: string | null;
  label: string | null;
  notes: string | null;
  source: "scanned" | "manual" | "both";
  tagStatus: "ok" | "missing_tag" | "not_applicable";
  liveStatus: "unchecked" | "active" | "dead" | "redirected" | "blocked" | "error";
  liveStatusCode: number | null;
  liveFinalUrl: string | null;
  liveCheckedAt: string | null;
  liveError: string | null;
  updatedAt: string;
  articles: AffiliateArticle[];
};

function tagLabel(status: AffiliateLink["tagStatus"]) {
  if (status === "ok") return "Tag OK";
  if (status === "missing_tag") return "Missing tag";
  return "N/A";
}

function liveLabel(status: AffiliateLink["liveStatus"]) {
  switch (status) {
    case "active":
      return "Active";
    case "dead":
      return "Dead";
    case "redirected":
      return "Redirected";
    case "blocked":
      return "Blocked";
    case "error":
      return "Error";
    default:
      return "Unchecked";
  }
}

export default function AdminAffiliatesPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [network, setNetwork] = useState("");
  const [tagStatus, setTagStatus] = useState("");
  const [liveStatus, setLiveStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const loadLinks = useCallback(() => {
    const params = new URLSearchParams();
    if (network) params.set("network", network);
    if (tagStatus) params.set("tagStatus", tagStatus);
    if (liveStatus) params.set("liveStatus", liveStatus);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/cms/affiliates?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as { links?: AffiliateLink[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load affiliate links.");
        setLinks(data.links ?? []);
        setError("");
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [network, tagStatus, liveStatus, search, reloadToken]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  useEffect(() => {
    setSelected(new Set());
  }, [network, tagStatus, liveStatus, search]);

  const allSelected = useMemo(
    () => links.length > 0 && links.every((link) => selected.has(link.id)),
    [links, selected],
  );

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(links.map((link) => link.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function rescan() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cms/affiliates/scan", { method: "POST" });
      const data = (await response.json()) as {
        scan?: {
          linksUpserted: number;
          occurrencesWritten: number;
          articlesScanned: number;
        };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Scan failed.");
      setMessage(
        `Scan complete: ${data.scan?.linksUpserted ?? 0} links, ${data.scan?.occurrencesWritten ?? 0} article refs (${data.scan?.articlesScanned ?? 0} articles).`,
      );
      setReloadToken((value) => value + 1);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkNow(ids?: string[]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cms/affiliates/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
      });
      const data = (await response.json()) as { checked?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Check failed.");
      setMessage(`Checked ${data.checked ?? 0} link(s).`);
      setReloadToken((value) => value + 1);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function fixMissingTags() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const previewResponse = await fetch("/api/cms/affiliates/fix-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const previewData = (await previewResponse.json()) as {
        fix?: {
          articlesUpdated: number;
          linksRewritten: number;
          catalogUpdated: number;
          skippedShortLinks: number;
        };
        error?: string;
      };
      if (!previewResponse.ok) {
        throw new Error(previewData.error ?? "Dry-run failed.");
      }

      const preview = previewData.fix;
      const planned =
        (preview?.articlesUpdated ?? 0) +
        (preview?.catalogUpdated ?? 0) +
        (preview?.linksRewritten ?? 0);
      if (planned === 0) {
        setMessage(
          `No missing/wrong tags found.${
            preview?.skippedShortLinks
              ? ` Skipped ${preview.skippedShortLinks} amzn.to short link(s).`
              : ""
          }`,
        );
        return;
      }

      const confirmed = window.confirm(
        `Fix Amazon tags to sls0fa-20?\n\n` +
          `Articles to update: ${preview?.articlesUpdated ?? 0}\n` +
          `Links to rewrite: ${preview?.linksRewritten ?? 0}\n` +
          `Catalog URLs to update: ${preview?.catalogUpdated ?? 0}\n` +
          `Skipped amzn.to: ${preview?.skippedShortLinks ?? 0}\n\n` +
          `Recovered articles will be saved as CMS overrides.`,
      );
      if (!confirmed) {
        setMessage("Tag fix cancelled.");
        return;
      }

      const applyResponse = await fetch("/api/cms/affiliates/fix-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const applyData = (await applyResponse.json()) as {
        fix?: {
          articlesUpdated: number;
          linksRewritten: number;
          catalogUpdated: number;
          skippedShortLinks: number;
          exportCount?: number;
          revalidated?: boolean;
          scan?: { linksUpserted: number };
        };
        error?: string;
      };
      if (!applyResponse.ok) {
        throw new Error(applyData.error ?? "Failed to fix tags.");
      }

      const fix = applyData.fix;
      setMessage(
        `Fixed tags: ${fix?.linksRewritten ?? 0} link(s) across ${fix?.articlesUpdated ?? 0} article(s)` +
          `${fix?.catalogUpdated ? `, ${fix.catalogUpdated} catalog URL(s)` : ""}` +
          `${fix?.skippedShortLinks ? ` (skipped ${fix.skippedShortLinks} amzn.to)` : ""}` +
          `${fix?.scan ? `. Rescanned ${fix.scan.linksUpserted} links.` : "."}`,
      );
      setReloadToken((value) => value + 1);
    } catch (fixError) {
      setError(fixError instanceof Error ? fixError.message : "Failed to fix tags.");
    } finally {
      setBusy(false);
    }
  }

  async function fixOneLink(link: AffiliateLink) {
    if (link.network !== "amazon") {
      setError("Tag fix only applies to Amazon links.");
      return;
    }
    if (link.tagStatus === "ok") {
      setMessage("This link already has the correct tag.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const previewResponse = await fetch("/api/cms/affiliates/fix-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, linkId: link.id }),
      });
      const previewData = (await previewResponse.json()) as {
        fix?: {
          articlesUpdated: number;
          linksRewritten: number;
          catalogUpdated: number;
          skippedShortLinks: number;
          samples?: Array<{ title: string; before: string; after: string }>;
        };
        error?: string;
      };
      if (!previewResponse.ok) {
        throw new Error(previewData.error ?? "Dry-run failed.");
      }

      const preview = previewData.fix;
      const planned =
        (preview?.articlesUpdated ?? 0) +
        (preview?.catalogUpdated ?? 0) +
        (preview?.linksRewritten ?? 0);
      if (planned === 0) {
        setMessage(
          `Nothing to fix for this link.${
            preview?.skippedShortLinks
              ? ` Skipped ${preview.skippedShortLinks} amzn.to short link(s).`
              : ""
          }`,
        );
        return;
      }

      const sample = preview?.samples?.[0];
      const confirmed = window.confirm(
        `Fix tag on this Amazon link to sls0fa-20?\n\n` +
          `${link.label || link.asin || link.normalizedUrl}\n\n` +
          `Articles: ${preview?.articlesUpdated ?? 0}\n` +
          `URL rewrites: ${preview?.linksRewritten ?? 0}\n` +
          `Catalog: ${preview?.catalogUpdated ?? 0}` +
          (sample ? `\n\nExample:\n${sample.before}\n→\n${sample.after}` : ""),
      );
      if (!confirmed) {
        setMessage("Tag fix cancelled.");
        return;
      }

      const applyResponse = await fetch("/api/cms/affiliates/fix-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, linkId: link.id }),
      });
      const applyData = (await applyResponse.json()) as {
        fix?: {
          articlesUpdated: number;
          linksRewritten: number;
          catalogUpdated: number;
        };
        error?: string;
      };
      if (!applyResponse.ok) {
        throw new Error(applyData.error ?? "Failed to fix tag.");
      }

      setMessage(
        `Fixed this link: ${applyData.fix?.linksRewritten ?? 0} rewrite(s) in ${applyData.fix?.articlesUpdated ?? 0} article(s)` +
          `${applyData.fix?.catalogUpdated ? `, ${applyData.fix.catalogUpdated} catalog URL(s)` : ""}.`,
      );
      setReloadToken((value) => value + 1);
    } catch (fixError) {
      setError(fixError instanceof Error ? fixError.message : "Failed to fix tag.");
    } finally {
      setBusy(false);
    }
  }

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cms/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          label: label.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to add link.");
      setUrl("");
      setLabel("");
      setNotes("");
      setMessage("Affiliate link saved.");
      setReloadToken((value) => value + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to add link.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(link: AffiliateLink, nextLabel: string, nextNotes: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/cms/affiliates/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: nextLabel.trim() || null,
          notes: nextNotes.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to update link.");
      setMessage("Link updated.");
      setReloadToken((value) => value + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update link.");
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(id: string) {
    if (!window.confirm("Delete this affiliate link from the tracker?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/cms/affiliates/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to delete link.");
      setMessage("Link deleted.");
      setExpandedId(null);
      setReloadToken((value) => value + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Affiliate links</h1>
        <p style={{ color: "var(--admin-muted, #64748b)", marginTop: "0.5rem" }}>
          Track Amazon and other affiliate URLs across articles, verify your Associates tag, and
          optionally probe live HTTP status.
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginTop: "1.25rem",
            alignItems: "center",
          }}
        >
          <button className="admin-button" type="button" disabled={busy} onClick={() => void rescan()}>
            {busy ? "Working…" : "Rescan articles"}
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void checkNow([...selected])}
          >
            Check selected
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            onClick={() => void checkNow()}
          >
            Check unchecked
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            onClick={() => void fixMissingTags()}
          >
            Fix missing/wrong tags
          </button>
          <span style={{ color: "var(--admin-muted, #64748b)", fontSize: "0.875rem" }}>
            {links.length} link{links.length === 1 ? "" : "s"}
          </span>
        </div>

        <form
          onSubmit={createLink}
          style={{
            display: "grid",
            gap: "0.75rem",
            marginTop: "1.25rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          }}
        >
          <input
            className="admin-input"
            placeholder="Affiliate URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
            style={{ gridColumn: "1 / -1" }}
          />
          <input
            className="admin-input"
            placeholder="Label (optional)"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <button className="admin-button" type="submit" disabled={busy}>
            Add link
          </button>
        </form>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginTop: "1.25rem",
          }}
        >
          <input
            className="admin-input"
            placeholder="Search URL, ASIN, label…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ minWidth: "14rem", flex: 1 }}
          />
          <select
            className="admin-input"
            value={network}
            onChange={(event) => setNetwork(event.target.value)}
          >
            <option value="">All networks</option>
            <option value="amazon">Amazon</option>
            <option value="other">Other</option>
          </select>
          <select
            className="admin-input"
            value={tagStatus}
            onChange={(event) => setTagStatus(event.target.value)}
          >
            <option value="">All tag statuses</option>
            <option value="ok">Tag OK</option>
            <option value="missing_tag">Missing tag</option>
            <option value="not_applicable">N/A</option>
          </select>
          <select
            className="admin-input"
            value={liveStatus}
            onChange={(event) => setLiveStatus(event.target.value)}
          >
            <option value="">All live statuses</option>
            <option value="unchecked">Unchecked</option>
            <option value="active">Active</option>
            <option value="dead">Dead</option>
            <option value="redirected">Redirected</option>
            <option value="blocked">Blocked</option>
            <option value="error">Error</option>
          </select>
        </div>

        {error ? <p style={{ color: "#b91c1c", marginTop: "1rem" }}>{error}</p> : null}
        {message ? <p style={{ color: "#047857", marginTop: "1rem" }}>{message}</p> : null}

        <table className="admin-table" style={{ marginTop: "1.25rem" }}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Link</th>
              <th>Network</th>
              <th>Tag</th>
              <th>Live</th>
              <th>Articles</th>
              <th>Last checked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const expanded = expandedId === link.id;
              return (
                <Fragment key={link.id}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(link.id)}
                        onChange={() => toggleOne(link.id)}
                        aria-label={`Select ${link.label || link.asin || link.id}`}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{link.label || link.asin || "Untitled"}</div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.normalizedUrl.length > 64
                          ? `${link.normalizedUrl.slice(0, 64)}…`
                          : link.normalizedUrl}
                      </a>
                      {link.asin ? (
                        <div style={{ color: "var(--admin-muted, #64748b)", fontSize: "0.8rem" }}>
                          ASIN {link.asin}
                          {link.affiliateTag ? ` · tag=${link.affiliateTag}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td>{link.network}</td>
                    <td>
                      <span className={`admin-status aff-tag-${link.tagStatus}`}>
                        {tagLabel(link.tagStatus)}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status aff-live-${link.liveStatus}`}>
                        {liveLabel(link.liveStatus)}
                        {link.liveStatusCode != null ? ` (${link.liveStatusCode})` : ""}
                      </span>
                    </td>
                    <td>{link.articles.length}</td>
                    <td>
                      {link.liveCheckedAt
                        ? new Date(link.liveCheckedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="admin-button"
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : link.id)}
                        >
                          {expanded ? "Hide" : "Details"}
                        </button>
                        {link.network === "amazon" && link.tagStatus === "missing_tag" ? (
                          <button
                            className="admin-button"
                            type="button"
                            disabled={busy}
                            onClick={() => void fixOneLink(link)}
                          >
                            Fix tag
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={8}>
                        <AffiliateDetail
                          link={link}
                          busy={busy}
                          onSave={(nextLabel, nextNotes) =>
                            void saveNotes(link, nextLabel, nextNotes)
                          }
                          onCheck={() => void checkNow([link.id])}
                          onFixTag={
                            link.network === "amazon" && link.tagStatus === "missing_tag"
                              ? () => void fixOneLink(link)
                              : undefined
                          }
                          onDelete={() => void removeLink(link.id)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {links.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  No affiliate links yet. Click <strong>Rescan articles</strong> or add one manually.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AffiliateDetail({
  link,
  busy,
  onSave,
  onCheck,
  onFixTag,
  onDelete,
}: {
  link: AffiliateLink;
  busy: boolean;
  onSave: (label: string, notes: string) => void;
  onCheck: () => void;
  onFixTag?: () => void;
  onDelete: () => void;
}) {
  const [editLabel, setEditLabel] = useState(link.label ?? "");
  const [editNotes, setEditNotes] = useState(link.notes ?? "");

  useEffect(() => {
    setEditLabel(link.label ?? "");
    setEditNotes(link.notes ?? "");
  }, [link.id, link.label, link.notes]);

  return (
    <div style={{ display: "grid", gap: "0.75rem", padding: "0.5rem 0" }}>
      <div>
        <strong>Full URL</strong>
        <div>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.url}
          </a>
        </div>
        {link.liveFinalUrl ? (
          <div style={{ color: "var(--admin-muted, #64748b)", fontSize: "0.875rem" }}>
            Redirect target: {link.liveFinalUrl}
          </div>
        ) : null}
        {link.liveError ? (
          <div style={{ color: "#b91c1c", fontSize: "0.875rem" }}>Check error: {link.liveError}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          className="admin-input"
          value={editLabel}
          onChange={(event) => setEditLabel(event.target.value)}
          placeholder="Label"
          style={{ minWidth: "12rem", flex: 1 }}
        />
        <input
          className="admin-input"
          value={editNotes}
          onChange={(event) => setEditNotes(event.target.value)}
          placeholder="Notes"
          style={{ minWidth: "12rem", flex: 2 }}
        />
        <button
          className="admin-button"
          type="button"
          disabled={busy}
          onClick={() => onSave(editLabel, editNotes)}
        >
          Save
        </button>
        <button className="admin-button" type="button" disabled={busy} onClick={onCheck}>
          Check now
        </button>
        {onFixTag ? (
          <button className="admin-button" type="button" disabled={busy} onClick={onFixTag}>
            Fix tag
          </button>
        ) : null}
        <button className="admin-button" type="button" disabled={busy} onClick={onDelete}>
          Delete
        </button>
      </div>

      <div>
        <strong>Articles ({link.articles.length})</strong>
        {link.articles.length === 0 ? (
          <p style={{ color: "var(--admin-muted, #64748b)" }}>Not found in any scanned article.</p>
        ) : (
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
            {link.articles.map((article) => (
              <li key={`${article.articleSource}-${article.articleId}`}>
                {article.articleSource === "database" ? (
                  <Link href={`/admin/articles/${article.articleId}`}>{article.articleTitle}</Link>
                ) : (
                  <span>{article.articleTitle}</span>
                )}{" "}
                <span style={{ color: "var(--admin-muted, #64748b)", fontSize: "0.85rem" }}>
                  ({article.articleSource}
                  {article.pathname ? ` · ${article.pathname}` : ""})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

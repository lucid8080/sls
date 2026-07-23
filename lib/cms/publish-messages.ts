export type PublishIssue = {
  code: string;
  message: string;
  severity: string;
};

/** Prefer blocking errors; fall back to all issues for display. */
export function formatPublishGateError(
  error: string | undefined,
  issues?: PublishIssue[],
): string {
  const list = issues ?? [];
  const blocking = list.filter((issue) => issue.severity === "error");
  const shown = blocking.length > 0 ? blocking : list;
  const title = error ?? "Quality gates failed.";
  if (shown.length === 0) {
    return title;
  }
  return `${title} ${shown.map((issue) => issue.message).join(" ")}`;
}

"use client";

export default function TopicInboxError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="admin-card">
      <h1>Topic Inbox unavailable</h1>
      <p className="admin-error" role="alert">
        The Topic Inbox could not be loaded. Check the database connection and try again.
      </p>
      <button className="admin-button" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}

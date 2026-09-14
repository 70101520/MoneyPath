'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="padded">
      <section className="panel padded">
        <h1>We couldn’t load your workspace.</h1>
        <p className="muted">
          Check that PostgreSQL is running, migrations are applied, and the environment keys are
          configured. Your records have not been changed.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

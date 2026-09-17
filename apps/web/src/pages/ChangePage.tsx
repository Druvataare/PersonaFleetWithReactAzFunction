import { useExceptions, useMigrations } from "../api/queries.ts";
import { ComingSoon, ErrorMessage, Kpi, Loading, PageHead } from "../components/ui.tsx";

export default function ChangePage() {
  const migrations = useMigrations();
  const exceptions = useExceptions();
  const error = migrations.error ?? exceptions.error;

  return (
    <>
      <PageHead
        step="04 · WHAT IS SHIFTING"
        title="Change"
        sub="People move between personas and ask for apps outside their catalogue. Both are early signals that a persona definition has drifted from the work."
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : !migrations.data || !exceptions.data ? (
        <Loading />
      ) : (
        <div className="g4">
          <Kpi value={migrations.data.length} label="Persona changes" />
          <Kpi value={migrations.data.reduce((a, m) => a + m.people, 0)} label="People reassigned" />
          <Kpi value={exceptions.data.length} label="App exceptions" />
          <Kpi
            value={exceptions.data.filter((e) => e.state === "Pending").length}
            label="Exceptions pending"
            tone="warn"
          />
        </div>
      )}
      <ComingSoon step={10}>
        Where people moved this quarter, most-requested apps outside a persona, and the by-persona table.
      </ComingSoon>
    </>
  );
}

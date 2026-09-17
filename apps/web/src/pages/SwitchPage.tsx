import { ComingSoon, PageHead } from "../components/ui.tsx";

export default function SwitchPage() {
  return (
    <>
      <PageHead
        step="05 · SWITCH"
        title="Persona change"
        sub="Pick a user, see their persona, choose a new one, and see the benefit before you apply it."
      />
      <ComingSoon step={10}>
        Select a user, see their current persona, choose a new one, review the impact table and apply the
        change.
      </ComingSoon>
    </>
  );
}

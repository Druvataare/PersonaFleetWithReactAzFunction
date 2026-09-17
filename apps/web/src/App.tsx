import { SCORING_VERSION } from "@pfc/scoring";
import ApiCheck from "./ApiCheck.tsx";

/* Placeholder until the app shell lands in step 4. */
export default function App() {
  return (
    <main className="scaffold">
      <p className="eyebrow">Endpoint experience portal</p>
      <h1>Persona Fleet Command</h1>
      <p>
        Scaffold ready. Scoring package <code>@pfc/scoring</code> v{SCORING_VERSION} is linked.
      </p>
      <ApiCheck />
    </main>
  );
}

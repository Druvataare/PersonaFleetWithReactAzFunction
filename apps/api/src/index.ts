/* Entry point: importing a module registers its functions with the host.
   Every new endpoint is imported here. */
import "./health.ts";
import "./reference/personas.ts";
import "./reference/baselines.ts";
import "./reference/catalog.ts";
import "./fleet/devices.ts";
import "./aggregate/mapping.ts";
import "./aggregate/tickets.ts";

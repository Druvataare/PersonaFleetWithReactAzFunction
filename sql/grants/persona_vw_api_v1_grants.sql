/*
  Persona Fleet Command — grant the API's identity read access to the views
  ----------------------------------------------------------------------------
  Run in the lakehouse SQL analytics endpoint (same editor as sql/gold and
  sql/checks). Grants func-personalfleet-api's managed identity SELECT on the
  ten persona_vw_api_v1_* views only — never a base table (AD-3, AD-18).

  No CREATE USER: the SQL analytics endpoint does not support it. Running
  GRANT against a name Fabric can resolve in Entra creates the database
  principal automatically.
  https://learn.microsoft.com/en-us/fabric/data-warehouse/sql-granular-permissions
  ("You can't explicitly run CREATE USER... When you run GRANT or DENY,
  Fabric creates the database user automatically.")

  Prerequisite: the identity must already have at least Read on this item
  (Lakehouse → Settings → SQL analytics endpoint → Share) — GRANT alone is
  not enough to connect, per the same doc: "The user can't connect until
  they also have sufficient workspace-level rights."
*/

GRANT SELECT ON dbo.persona_vw_api_v1_freshness       TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_persona         TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_persona_app     TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_ticket_category TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_device          TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_device_ticket   TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_device_app      TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_ticket          TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_title_mapping   TO [func-personalfleet-api];
GRANT SELECT ON dbo.persona_vw_api_v1_migration       TO [func-personalfleet-api];

-- Check: confirms the principal now exists and lists exactly what it can read.
SELECT DISTINCT pr.name, pr.type_desc, pr.authentication_type_desc, pe.permission_name, pe.state_desc
FROM sys.database_principals AS pr
JOIN sys.database_permissions AS pe ON pe.grantee_principal_id = pr.principal_id
WHERE pr.name = 'func-personalfleet-api'
ORDER BY pe.permission_name;

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

/* Check: confirms the principal exists and names every object it can read.
   Expect twelve rows: one CONNECT (from the item-level share, which has no
   object), one SELECT per view, and nothing else. An object listed here that
   is not a persona_vw_api_v1_* view means something granted more than AD-3
   intends — most likely the "Read all data using SQL analytics endpoint" box
   was ticked when the lakehouse was shared, which grants blanket read and
   makes these GRANTs decorative. */
SELECT pr.name AS principal_name, pr.type_desc, pr.authentication_type_desc,
       o.name AS object_name, pe.permission_name, pe.state_desc
FROM sys.database_principals AS pr
JOIN sys.database_permissions AS pe ON pe.grantee_principal_id = pr.principal_id
LEFT JOIN sys.objects AS o ON o.object_id = pe.major_id AND pe.class = 1
WHERE pr.name = 'func-personalfleet-api'
ORDER BY pe.permission_name, o.name;

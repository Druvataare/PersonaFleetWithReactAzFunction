/*
  Persona Fleet Command — grant the API's identity access to the config store
  ------------------------------------------------------------------------
  Run in the SQL database in Fabric (Persona_Config_Dev), after 05a and 05b.

  Prerequisite, exactly as on the lakehouse: the identity must already hold
  the item's Read permission — Share the database, add func-personalfleet-api,
  and tick none of the additional permissions. GRANT alone does not let it
  connect. We own this database, so unlike the lakehouse this is ours to do.

  No CREATE USER: on the lakehouse SQL analytics endpoint it is rejected
  outright, and GRANT creates the database principal automatically. Starting
  the same way here keeps one pattern across both stores; if this database
  turns out to want an explicit CREATE USER ... FROM EXTERNAL PROVIDER, the
  GRANTs below will say so by failing on an unresolved name.

  Writes, unlike the lakehouse. The three writeback tables take INSERT and
  UPDATE because that is the whole point of this store (AD-5). persona_policy
  is deliberately SELECT only: the API reads baselines to score devices, and
  editing them belongs to the Baselines page in step 9 — that grant should be
  added consciously, when something actually writes them, rather than left
  open in advance.

  No DELETE anywhere. Every table here is a record of something that
  happened: a requested change, a raised request, a decided exception.
  Withdrawing one is a State change, not a disappearance, so nothing in the
  API has a reason to remove a row.
*/

GRANT SELECT                 ON dbo.persona_policy               TO [func-personalfleet-api];
GRANT SELECT, INSERT, UPDATE ON dbo.persona_change               TO [func-personalfleet-api];
GRANT SELECT, INSERT, UPDATE ON dbo.persona_provisioning_request TO [func-personalfleet-api];
GRANT SELECT, INSERT, UPDATE ON dbo.persona_app_exception        TO [func-personalfleet-api];
GO

/* Check: names every object the identity can reach and what it may do.
   Expect 11 rows — one CONNECT (from the share, which has no object),
   SELECT on persona_policy, and SELECT/INSERT/UPDATE on each of the three
   writeback tables. Anything else, especially DELETE or a grant on an object
   not listed above, means something granted more than intended. */
SELECT pr.name AS principal_name, pr.type_desc, pr.authentication_type_desc,
       o.name AS object_name, pe.permission_name, pe.state_desc
FROM sys.database_principals AS pr
JOIN sys.database_permissions AS pe ON pe.grantee_principal_id = pr.principal_id
LEFT JOIN sys.objects AS o ON o.object_id = pe.major_id AND pe.class = 1
WHERE pr.name = 'func-personalfleet-api'
ORDER BY o.name, pe.permission_name;

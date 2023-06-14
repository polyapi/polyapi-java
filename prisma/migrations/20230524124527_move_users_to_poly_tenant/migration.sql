BEGIN TRANSACTION;

UPDATE "tenant"
SET name = 'poly-system'
WHERE name = 'poly';

-- poly-trial
INSERT INTO "tenant" (id, name)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))),
        'poly-trial');

INSERT INTO "environment" (id, name, tenant_id, subdomain, app_key)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))),
        'default',
        (SELECT id from "tenant" WHERE name = 'poly-trial'),
        lower(hex(randomblob(4))),
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))));

INSERT INTO "team" (id, name, tenant_id)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))),
        'Demo Users Team',
        (SELECT id from "tenant" WHERE name = 'poly-trial'));

UPDATE "user"
SET role    = 'USER',
    team_id = (SELECT id FROM "team" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial'))
WHERE team_id <> (SELECT id FROM "team" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-system'));

UPDATE "user_key"
SET environment_id = (SELECT id
                      FROM "environment"
                      WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial')),
    permissions    = '{"use": true, "teach": true, "customDev": true, "authConfig": true}'
WHERE environment_id <>
      (SELECT id FROM "environment" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-system'));

INSERT INTO "user" (id, name, role, team_id)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))),
        'Admin',
        'ADMIN',
        (SELECT id from "team" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial')));

INSERT INTO "user_key" (id, user_id, environment_id, key, permissions)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))),
        (SELECT id
         FROM "user"
         WHERE team_id = (SELECT id from "team" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial')) AND role = 'ADMIN'),
        (SELECT id from "environment" WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial')),
        'ptab4f62d3421bca3674hfd627',
        '{}');

UPDATE "api_function"
SET environment_id = (SELECT id
                      FROM "environment"
                      WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial'));

UPDATE "webhook_handle"
SET environment_id = (SELECT id
                      FROM "environment"
                      WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial'));

UPDATE "custom_function"
SET environment_id = (SELECT id
                      FROM "environment"
                      WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial'));

UPDATE "auth_provider"
SET environment_id = (SELECT id
                      FROM "environment"
                      WHERE tenant_id = (SELECT id from "tenant" WHERE name = 'poly-trial'));
DELETE
FROM "team"
WHERE (SELECT COUNT("user".id) FROM "user" WHERE team_id = "team".id) = 0;

DELETE
FROM "environment"
WHERE (SELECT COUNT("user_key".id) FROM "user_key" WHERE environment_id = "environment".id) = 0;

DELETE
FROM "tenant"
WHERE (SELECT COUNT("environment".id) FROM "environment" WHERE tenant_id = "tenant".id) = 0;

COMMIT TRANSACTION;

ALTER TABLE "AuthToken" ADD COLUMN "sessionVersion" INTEGER;

UPDATE "AuthToken" AS token
SET "sessionVersion" = app_user."sessionVersion"
FROM "User" AS app_user
WHERE token."userId" = app_user."id";

ALTER TABLE "AuthToken" ALTER COLUMN "sessionVersion" SET NOT NULL;

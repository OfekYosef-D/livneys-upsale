-- Keep the currently verified MFA factor active while an administrator
-- prepares and verifies a replacement authenticator.
ALTER TABLE "User"
  ADD COLUMN "mfaPendingSecretEncrypted" TEXT;

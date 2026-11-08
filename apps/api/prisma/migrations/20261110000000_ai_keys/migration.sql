-- Remember which .env keys were copied into Settings one by one, so ANTHROPIC_API_KEY can be
-- copied once too, after JOBHUNTER_API_TOKEN already was.
ALTER TABLE "User" ADD COLUMN "adoptedEnvKeys" "ApiKeyKind"[] DEFAULT ARRAY[]::"ApiKeyKind"[];

UPDATE "User" SET "adoptedEnvKeys" = ARRAY['JOBHUNTER']::"ApiKeyKind"[] WHERE "envKeysAdopted";

ALTER TABLE "User" DROP COLUMN "envKeysAdopted";

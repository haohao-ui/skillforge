CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "users_set_updated_at"
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "skill_generations_set_updated_at"
BEFORE UPDATE ON "skill_generations"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();

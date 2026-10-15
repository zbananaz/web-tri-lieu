-- Chong trung lich: mot chuyen gia (hoac mot khach) khong the co hai lich dang hieu luc chong len nhau.
-- Can extension btree_gist de dung so sanh bang tren uuid trong rang buoc EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_expert_overlap" EXCLUDE USING gist ("expert_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" IN ('requested', 'confirmed'));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_client_overlap" EXCLUDE USING gist ("client_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" IN ('requested', 'confirmed'));

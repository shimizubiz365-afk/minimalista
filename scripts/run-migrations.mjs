// 使い方: DATABASE_URL="postgres://..." node scripts/run-migrations.mjs
// supabase/migrations/*.sql を昇順に流し、documents ストレージバケットを作成する。
import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migDir = join(__dirname, "..", "supabase", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const BUCKET_SQL = `
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
`;

async function main() {
  await client.connect();
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), "utf8");
    process.stdout.write(`-- applying ${f} ... `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (e) {
      console.log("FAIL");
      console.error(`   ${e.message}`);
      throw e;
    }
  }
  process.stdout.write("-- creating storage bucket 'documents' ... ");
  await client.query(BUCKET_SQL);
  console.log("OK");
  await client.end();
  console.log("\n✅ all migrations + bucket applied");
}

main().catch((e) => {
  console.error("\n❌ migration failed:", e.message);
  process.exit(1);
});

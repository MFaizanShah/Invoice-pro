// Creates (or updates) the admin user in Supabase Auth.
// Run with: npm run seed:admin
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.NEXT_PUBLIC_AUTH_DOMAIN || "invoicepro.app";
const username = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";

if (!url || !key || !username || !password) {
  console.error("Missing env vars. Check .env.local (URL, SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD).");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${username}@${domain}`;

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listErr) { console.error(listErr.message); process.exit(1); }

const existing = list.users.find((u) => u.email === email);
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Updated admin "${username}".`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username, role: "admin" },
  });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Created admin "${username}".`);
}
console.log("Reminder: disable public sign ups in Supabase (Authentication > Providers > Email).");

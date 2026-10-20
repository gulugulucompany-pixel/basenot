# D.S. Electrical website (converted from the Homeworld codebase)

> **Conversion note:** content is now D.S. Electrical (services, phone +44 7517 269949). Original CSS is untouched; the premium blue styling lives in `premium.css` (site) and `premium-admin.css` (admin), loaded after it. Opening times, inspection fee, coverage areas and trust statements are blank by default because they were Homeworld's, not verified for D.S. Electrical. The sections below still describe the unchanged Supabase/Vercel setup; ignore their Homeworld wording and appliance examples.

This update keeps the existing website structure, visual styling and Repair Concierge, and adds a product catalogue, product enquiries, a Supabase-backed owner dashboard, persistent image storage, saved customer enquiries, and the requested Opening Times section. It is not a rebuild from scratch.

## Current status (read first)

- **No deployment was performed.** No public site, domain, subscription, or billing setting was changed by this work.
- **No Homeworld products were seeded.** The public catalogue says “No products have been published yet” until an owner adds real products. Price fields are optional and blank by default. New products default to “Contact us to check” availability, not assumed stock.
- The default Opening Times are exactly:
  - Monday–Friday: 9:15 am – 5:00 pm
  - Saturday: 9:15 am – 4:00 pm
  - Sunday: Closed
  The same saved hours display near contact details and in the footer. The owner can edit these fields in the Business tab and save them persistently.
- **Supabase, Resend and owner login are not configured yet.** You must complete the setup below before live product changes or customer enquiries can be verified.
- The existing design contains template claims, service-area examples, a diagnostic fee example, and other copy from the original site. A visible demonstration banner warns that template claims, coverage and diagnostic pricing are examples, not verified Homeworld facts. Review and replace them before launch; the requested Opening Times are separately set to the hours you provided.
- Automated tests use mocked Supabase/email calls; they are not a substitute for testing your real Supabase project and Resend sender.

## Admin login troubleshooting (added)

The browser reads **only `supabase-config.js`**. Vercel environment variables are NOT injected into static files, so setting `SUPABASE_URL` in Vercel does not configure the admin login. Edit `supabase-config.js` with the project URL (`https://<ref>.supabase.co`) and the publishable/anon key, then redeploy. Vercel env vars (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, ...) are for the `/api` enquiry function only.

The admin page now states which setting is wrong. Also required: the user must exist in Supabase > Authentication > Users (the account's password must meet your project's minimum length) and its UUID must be the `owner_id` in `site_settings`. Hero and gallery photos can now be uploaded (stored in the existing `product-images` bucket) or pasted as https URLs.

## What is included

| Path | Purpose |
|---|---|
| `index.html`, `site.js`, `site-defaults.js` | Existing public website, Repair Concierge, Opening Times, public product catalogue and product enquiry form |
| `admin.html` | Real Supabase Auth sign-in; business settings; editable Opening Times; existing site content controls; add/edit/publish/unpublish/delete products; upload product images; view and update enquiry statuses |
| `api/send-repair-request.js` | Vercel server-side function: validates repair/product enquiries, saves them to Supabase, and optionally notifies the configured business email with Resend |
| `lib/enquiry.js` | Server-side request validation, HTML escaping, email construction |
| `supabase/schema.sql` | Database tables, indexes, triggers, Row Level Security policies and `product-images` storage bucket policies |
| `supabase-config.js` | Public Supabase URL and publishable key only; these are safe for browser use when the included RLS policies are applied |
| `.env.example` | Names of server-only environment variables; contains no real secrets |
| `vercel.json` | Existing `/admin` route and security headers |
| `test/test.js` | Offline unit/integration-style tests using injected test doubles; run with `npm test` or `node test/test.js` |
| `_original/` | Original HTML retained for reference; it is not used by the live app |

There are no npm runtime packages in this update. The admin uses the Supabase JavaScript client from a CDN; Vercel's serverless handler uses built-in `fetch` and Node.js APIs. Use Node.js 18 or newer for local tests.

## 1. Free-tier notes checked on 19 October 2026

- **Supabase Free:** currently lists two active free projects, 50,000 monthly active users, 500 MB database size, 1 GB file storage and 5 GB egress. Free projects can be paused after a week of low activity. Monitor quotas and retain your own backups; free-plan database backups are limited. Check the [official Supabase pricing page](https://supabase.com/pricing) and [project pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing) before relying on it for a business site.
- **Resend Free:** currently lists $0/month, 3,000 emails/month, a 100-email daily limit and 3 domains. A verified sender domain is recommended for real customer notifications; the test sender has restrictions. See [Resend pricing](https://resend.com/pricing).
- **Vercel Hobby:** is free but the current plan terms limit it to non-commercial, personal use. Because Homeworld is described as a small-business website, check whether your existing deployment's plan is eligible before commercial use. Do not upgrade or enable billing without the owner's explicit approval. See [Vercel Hobby plan and terms](https://vercel.com/docs/plans/hobby).
- Supabase recommends the newer `sb_publishable_...` and `sb_secret_...` API keys; its documentation says the legacy `anon` and `service_role` keys are being deprecated by the end of 2026. The code accepts a legacy server key as a compatibility fallback, but prefer the new keys. See [Supabase API key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

The free plans may change and have provider-specific terms. This project does not enable billing, and it does not auto-upgrade when a quota is reached.

## 2. Create Supabase and configure the database

1. Create a Supabase project on the Free plan if it meets your needs. Keep billing disabled unless you separately decide to pay.
2. In **SQL Editor**, open a new query, paste the entire contents of `supabase/schema.sql`, and run it. It creates `site_settings`, `products`, and `enquiries`, enables Row Level Security, and configures the image bucket/policies.
3. In **Authentication → Users**, create the real owner account using an email you control and a strong unique password. Do not use demo credentials. Copy the user's UUID. Enable email/password sign-in and configure allowed redirect URLs for your future Vercel website, especially `/admin.html`, in **Authentication → URL Configuration**.
4. Insert the single website owner row in the SQL Editor, replacing the placeholder UUID with that Auth user's UUID:

   ```sql
   insert into public.site_settings (id, owner_id, config)
   values (1, 'PASTE-AUTH-USER-UUID-HERE', '{}'::jsonb);
   ```

   Do not run the insert a second time if row `id = 1` already exists. Changing `owner_id` transfers the website's administrative authority; only do that intentionally.
5. If password-reset and owner verification emails need to reliably reach the owner, review **Authentication → SMTP Settings**. Supabase's default email service has restrictions; a custom SMTP provider may be needed and may have its own limits/costs. Do not subscribe to a paid provider without permission.
6. In Supabase **Project Settings / Connect**, copy the project URL and the **publishable key** (`sb_publishable_...`). Edit `supabase-config.js` and fill only these public values:

   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://YOUR-PROJECT-REF.supabase.co',
     anonKey: 'sb_publishable_REPLACE_WITH_YOUR_KEY'
   };
   ```

   The property remains named `anonKey` for compatibility with the current code, but its value may be the new publishable key. If your project only offers the legacy `anon` key, it works as a temporary fallback. The browser key is public; **never** paste a secret/service-role key into this file. The site sends the key in the `apikey` header; newer `sb_publishable_...` and `sb_secret_...` values are opaque keys, not JWT bearer tokens.

## 3. Configure server-side Vercel environment variables

In the existing Vercel project, go to **Settings → Environment Variables** and add the following variables for the deployment environments you use. These values must be configured in Vercel, not in frontend JavaScript or committed to Git.

| Variable | Required? | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Same Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Server-only `sb_secret_...` key; bypasses RLS, so protect it carefully |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback only | Old `service_role` key if a new secret key is not available yet; don't set both unless you intentionally want the new key to take precedence |
| `RESEND_API_KEY` | Optional | Secret API key from Resend |
| `RESEND_FROM` | Optional with email notifications | Verified sender, e.g. `Homeworld <enquiries@your-verified-domain.example>` |
| `DEFAULT_RECIPIENT_EMAIL` | Optional | Trusted server-side fallback recipient if the saved Business contact email is blank; never read from the browser request |
| `SITE_ID` | Optional | Label for notification idempotency keys; defaults to `homeworld` |
| `ALLOWED_ORIGIN` | Optional | Comma-separated origin allow-list, e.g. `https://your-site.vercel.app` |
| `TIMEZONE` | Optional | Time zone used in notification timestamps; defaults to UTC. `Asia/Kathmandu` is set as the example. |

`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `RESEND_API_KEY` are private server values. Do not place them in `index.html`, `admin.html`, `site.js`, `supabase-config.js`, public GitHub files or client-side environment variables. Rotate a key immediately if it is accidentally exposed.

For Resend, create an API key and set `RESEND_FROM` to a sender that Resend allows. To notify arbitrary real customer/business inboxes, verify a sender domain and follow the current Resend account requirements. Until the email variables and a trusted recipient are configured, enquiries can still be stored but email notification is marked `not_configured` and the customer is not told that an email was sent.

## 4. Owner dashboard and persistent business information

1. Deploy/configure the code only when you're ready, then open `/admin` or `/admin.html`.
2. Sign in with the Supabase owner account created in step 2. A valid Supabase login is not enough on its own: the account UUID must match `site_settings.owner_id`.
3. In **Business**, review the name and public contact details. The public contact email is where server-side enquiry notifications are sent; it is separate from the owner's login email. Edit Opening Times here if needed, then press **Save changes**. The saved times are read by both the contact section and footer and are persisted in Supabase.
4. Use **Products** to add real items. Name is required; description, category, price and image may be left blank where not yet known. New records start unpublished. Upload accepts JPEG, PNG, WebP and AVIF up to 5 MB. Use **Publish** only after checking the information; public changes appear on the website for visitors across devices.
5. Use **Enquiries** to review customer repair/product requests, their submission timestamps, email-notification status, and update a request to New / Contacted / Resolved / Archived. The server saves an enquiry first. If email delivery fails, the saved enquiry remains in the dashboard and the response does not claim a notification was sent.
6. Review **Website Content**, **Pricing & Areas**, **Appliances** and **Photography**. Remove or edit template service claims, sample locations and example diagnostic pricing before launch. Keep the demonstration banner on until the site copy is genuinely ready; disable sample review cards unless those testimonials are real and permissioned.

## 5. Database and security design

- Public visitors can read only published products, public website settings and product images. The public settings table is intentionally readable because it contains display content; never store passwords, private customer data, or API keys in `config`.
- Enquiries are not given an anonymous insert/select policy. The Vercel function validates the request and writes with its server-only Supabase secret. Only the authenticated registered owner can read/update enquiry records.
- Product mutations and uploads/deletes require Supabase Auth and owner-matching RLS/storage policies. Product rows and uploaded images are associated with that account.
- The browser cannot choose the email recipient. The server uses the saved business contact email or the configured trusted `DEFAULT_RECIPIENT_EMAIL` fallback.
- Validation includes field size/type checks, phone/email/contact-method checks, repair/product-specific requirements, a hidden honeypot field, request-body size limits, a best-effort per-IP rate limit and HTML escaping in notifications. Do not treat the in-memory rate limiter as strong or distributed spam protection; it resets between serverless instances. If spam becomes an issue, discuss CAPTCHA/Turnstile or a shared rate-limit store before adding another service.
- Supabase's secret key has elevated access and bypasses RLS. It must only be available to the server function. Do not grant public database access to `enquiries` or remove the included policies.

## 6. Local preview and automated checks

From the project directory using Node.js 18+:

```bash
node --check site.js
node --check api/send-repair-request.js
node --check lib/enquiry.js
node test/test.js
```

Or run `npm test`. The test script is dependency-free and uses test doubles for database/email actions; a passing result validates the exercised server logic only, not your live Supabase settings, Resend credentials, real email deliverability, mobile browser rendering, or production deployment.

To preview static page layout:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` and `http://localhost:8000/admin.html`. The Python server does **not** run the Vercel `/api` function, so it cannot verify live form submissions. Configure/deploy the API on Vercel when ready; do not treat a local static preview as a complete backend test.

## 7. Release checklist

- [ ] Run the SQL schema against the intended Supabase project.
- [ ] Create an owner Auth user and initialize `site_settings.owner_id` with that user's exact UUID.
- [ ] Put only the project URL and publishable key in `supabase-config.js`.
- [ ] Set server secrets in Vercel environment variables, not the frontend.
- [ ] Configure the Supabase Auth redirect URLs for the real site, and test password recovery.
- [ ] Configure and verify the Resend sender and trusted recipient; send a real test to an inbox you control.
- [ ] Log in to `/admin`, save settings including the specified Opening Times, and verify them from a signed-out/private browser or another device.
- [ ] Create a test product with a clearly labelled test name, leave it unpublished first, test image upload/edit/unpublish/delete, then remove the test item before launch.
- [ ] Submit repair and product enquiries; confirm database rows, timestamps, statuses and email-notification state.
- [ ] Verify a signed-out visitor cannot read enquiries, edit products, or upload/delete images. Verify another authenticated user cannot use owner features.
- [ ] Replace template copy, $89 example diagnostic fee, example service areas, warranty/OEM/credit claims and any other unverified information. Confirm the demo banner/review placeholders are handled appropriately.
- [ ] Check the Vercel plan is permitted for the intended business use before publicly launching. Do not turn on paid billing unless the owner expressly approves.

## Troubleshooting

- **Admin says the owner isn't registered:** compare the signed-in Auth UUID with `public.site_settings.owner_id`.
- **Public products don't appear:** confirm the record has `published = true`, the browser URL/key are correct and `supabase/schema.sql` policies were applied.
- **Image uploads fail:** check the `product-images` bucket and storage policies from the SQL file; verify file type and that the file is under 5 MB.
- **Customer form returns setup required:** confirm `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or temporary legacy fallback) are present in the Vercel function environment and the `site_settings` row exists.
- **The enquiry is saved but email says it couldn't notify:** check `RESEND_API_KEY`, `RESEND_FROM`, the saved Business contact email or trusted fallback, Resend domain verification and Vercel function logs. The dashboard still keeps saved requests if delivery fails.
- **Supabase Free project is paused or over quota:** follow the current Supabase dashboard guidance. Do not enable a paid plan unless explicitly approved.

# AstroOrbi Android Sandbox

Deploy only the `mobile/android-yookassa-test` branch in a separate Replit App. Its `.replit` only starts the Android sandbox. Scope is mobile sign-in, profile, balance, and one-month purchases.

## Database and deployment

1. Identify a new, empty PostgreSQL database in the sandbox project's database panel. Check its host/database against the connection string and verify the public schema has no tables. On that database only, install the application schema with `DATABASE_URL="$ANDROID_SANDBOX_DATABASE_URL" npm run db:push`. This adds the mobile link-code table as part of the application schema.
2. In the same database, create `public.android_sandbox_identity(marker text primary key)` and insert a single random marker of at least 32 characters. Put the connection string and matching marker in `ANDROID_SANDBOX_DATABASE_URL` and `ANDROID_SANDBOX_DATABASE_MARKER` in the sandbox Secrets. The entry point checks the marker with a read-only query before loading application storage.
3. Set `ANDROID_SANDBOX_ORIGIN` to the project's published HTTPS origin, `JWT_SECRET` to a new random secret of at least 32 characters, and `MOBILE_RU_CHECKOUT_TESTERS` to one synthetic numeric ID, e.g. `900000000001`. Set `YOOKASSA_TEST_MODE=true` in the publishing environment. Add `YOOKASSA_SHOP_ID` and the `test_` key in `YOOKASSA_SECRET_KEY` from the test shop when available. No Telegram bot token is needed.
4. Publish and verify `GET /api/health` identifies the sandbox. In the test shop subscribe to `payment.succeeded` and `payment.canceled` at `<origin>/webhooks/yookassa`. Checkout uses `<origin>/mobile/payment-return`.
5. From a shell with the sandbox's environment and database, run `npm run android:sandbox -- --issue-code` to create the synthetic profile and issue a five-minute code. Issue a fresh code immediately before testing. The profile starts with no subscription. Reissuing a code does not reset its subscription.

## Sideload build

From `mobile/`, set `VITE_ASTROORBI_API_URL` to the published HTTPS origin. Use a fresh generated Android project.

```sh
npm ci
npm run build -- --mode android-sandbox
npx cap add android
npm run prepare:android
ASTROORBI_ANDROID_SANDBOX=1 PLAY_APPLICATION_ID=app.astroorbi.sandbox node scripts/prepare-play-internal.mjs
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is in `app/build/outputs/apk/debug/`. The debug signature is for sideloading. The test application and payment-return scheme use separate identifiers.

#!/usr/bin/env bash
set -eu

sandbox_project='d0391cc8-ca98-4914-9251-e6113ee114e0'
if [[ ${REPL_ID:-} != "$sandbox_project" ]]; then
  printf '%s\n' 'This launcher is restricted to AstroOrbi Android Sandbox.' >&2
  exit 1
fi

export ANDROID_SANDBOX_DATABASE_URL="${DATABASE_URL:?Replit PostgreSQL binding is required}"
export ANDROID_SANDBOX_DATABASE_MARKER="$sandbox_project"
export ANDROID_SANDBOX_ORIGIN="${ANDROID_SANDBOX_ORIGIN:-https://${REPLIT_DEV_DOMAIN:-astro-orbi-android-sandbox.replit.app}}"
export JWT_SECRET="${JWT_SECRET:-${SESSION_SECRET:?Replit session secret is required}}"
export MOBILE_RU_CHECKOUT_TESTERS="${MOBILE_RU_CHECKOUT_TESTERS:-900000000001}"
export YOOKASSA_TEST_MODE=true
exec npm run android:sandbox -- "$@"

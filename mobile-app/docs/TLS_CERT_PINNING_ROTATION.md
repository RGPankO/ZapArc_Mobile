# TLS Certificate Pinning Rotation Runbook

## Scope
This app pins wallet API public keys using `react-native-ssl-public-key-pinning`.

## Where pins are configured
- Env var: `EXPO_PUBLIC_API_PINNED_KEYS`
- Format: comma-separated SHA-256 SPKI hashes
- Example:
  - `EXPO_PUBLIC_API_PINNED_KEYS=sha256/oldKeyHash,sha256/newKeyHash`

The app reads this in `src/config/security.ts` and initializes pinning in `src/services/tlsPinningService.ts`.

## Rotation strategy (overlap)
1. Generate and validate the new certificate/public key hash.
2. Deploy app config with both old and new hashes in `EXPO_PUBLIC_API_PINNED_KEYS`.
3. Roll server cert.
4. Observe client traffic and TLS failures.
5. After migration window, remove old hash in next app config release.

## Incident handling
If a rotation is wrong or cert is unexpected:
1. Symptom in app: API calls fail with `TLS_PINNING_FAILED` user-safe message.
2. Immediate mitigation:
   - Verify API host certificate chain and SPKI hash.
   - Restore known-good cert or publish corrected hash list with overlap.
3. Rollback path:
   - Revert config to last known-good pin set.
   - If needed, roll back server cert to prior known-good cert.

## Operational checks
- Confirm `EXPO_PUBLIC_API_URL` host matches pinned domain.
- Confirm all production API edges present certs matching one configured pin.
- Test a wallet API request in a release-like build before rollout sign-off.

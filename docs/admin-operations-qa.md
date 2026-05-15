# Admin Operations Smoke Test and QA

This verification layer is intentionally small and safe. It checks that Admin Operations routes reject missing auth, optionally verifies non-admin denial, optionally verifies admin read-only response shape, and probes mutation routes only with validation failures that should not create or modify data.

## Smoke Script

Start the local API server first:

```bash
npm run dev
```

Run the no-secrets baseline:

```bash
npm run smoke:admin-operations
```

The baseline verifies missing auth returns `401` for:

- `GET /api/admin/founders`
- `GET /api/admin/founders/:userId`
- `GET /api/admin/founders/:userId/academy-progress`
- `POST /api/admin/founders/:userId/notes`
- `POST /api/admin/founders/:userId/notifications`
- `POST /api/admin/founders/:userId/academy-progress`
- `POST /api/admin/founders/:userId/reset-assessment`
- `GET /api/admin/feedback`
- `PATCH /api/admin/feedback/:id`
- `POST /api/admin/access/grant-comp`
- `POST /api/admin/access/remove-comp`
- `POST /api/admin/access/suspend`
- `POST /api/admin/access/reactivate`
- `POST /api/admin/access/revoke`
- `POST /api/admin/access/churn-note`
- `GET /api/admin/audit`

Optional read-only/admin checks:

```bash
$env:ADMIN_SMOKE_ADMIN_TOKEN="admin-session-jwt"
$env:ADMIN_SMOKE_USER_ID="existing-founder-uuid"
npm run smoke:admin-operations
```

Optional non-admin denial checks:

```bash
$env:ADMIN_SMOKE_NON_ADMIN_TOKEN="non-admin-session-jwt"
npm run smoke:admin-operations
```

Optional alternate local API:

```bash
npm run smoke:admin-operations -- --base-url http://127.0.0.1:3001
```

The script does not require production secrets. Do not point it at production unless you intend to perform read-only route checks there. Even with an admin token, mutation routes are called only with invalid or incomplete payloads so they should return `400` before any database write.

## Manual UI QA Checklist

Use a non-production environment with an admin account and at least one test founder.

- [ ] Admin Hub opens Admin Operations for an admin/owner.
- [ ] Founder list loads with default pagination.
- [ ] Founder list search and stage/access filters do not crash.
- [ ] Founder drawer opens from a founder row.
- [ ] Founder profile, access/billing, activity counts, documents, archives, actions, support notes, and recent audit previews render.
- [ ] Academy progress displays stage totals and lesson rows.
- [ ] Academy repair modal requires a reason before submit.
- [ ] Assessment reset requires the typed `RESET ASSESSMENT` confirmation.
- [ ] Internal note creation requires valid note text and then appears in recent support notes.
- [ ] Founder notification creation requires confirmation before send.
- [ ] Access actions require reason text.
- [ ] Revoke access requires the typed `REVOKE ACCESS` confirmation.
- [ ] Feedback Inbox loads with status/reaction filters.
- [ ] Feedback status update saves and refreshes the selected feedback detail.
- [ ] Audit Log tab loads and paginates.
- [ ] Audit Log action, entity, search, and date filters do not crash.
- [ ] Audit Log displays newly created admin actions after note, notification, access, feedback, or academy repair operations.
- [ ] Audit Log expanded row shows reason, admin actor, target founder, IP/user agent, `before_state`, `after_state`, and `metadata`.

## Stabilization Notes

- Keep export/delete/edit out of the audit log until the read-only workflow is stable.
- Prefer test founders and local/staging data for any manual mutation QA.
- If a route returns `500`, inspect server logs before adding new Admin Operations features.

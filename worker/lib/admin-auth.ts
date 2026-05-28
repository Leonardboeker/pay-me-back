// worker/lib/admin-auth.ts
// Validates the X-Admin-Token header against PAYLEO_ADMIN_TOKEN env var.
// D-09: Plain string equality is sufficient for single-user admin behind HTTPS +
// Cloudflare bot protection. Constant-time compare not warranted at this scope.

export function validateAdminToken(
  req: Request,
  env: { PAYLEO_ADMIN_TOKEN: string }
): { ok: boolean; status: number } {
  const provided = req.headers.get('X-Admin-Token');
  if (!provided) {
    return { ok: false, status: 401 };
  }
  if (provided !== env.PAYLEO_ADMIN_TOKEN) {
    return { ok: false, status: 403 };
  }
  return { ok: true, status: 200 };
}

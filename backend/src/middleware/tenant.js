import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

// Resolves the active tenant from the X-Tenant header or subdomain and attaches it to req.tenant.
// Tenant-scoped queries downstream MUST filter by req.tenant.id.
export async function resolveTenant(req, res, next) {
  try {
    let slug = req.header('X-Tenant');

    if (!slug) {
      const host = req.hostname || '';
      const parts = host.split('.');
      if (parts.length > 2) slug = parts[0]; // sub.domain.tld → "sub"
    }

    if (!slug) {
      throw new ApiError(404, 'TENANT_NOT_FOUND', 'No tenant specified (set the X-Tenant header)');
    }

    const { rows } = await query(
      'SELECT id, name, slug, center_lat, center_lng, settings, is_active FROM tenants WHERE slug = $1',
      [slug],
    );
    const tenant = rows[0];
    if (!tenant || !tenant.is_active) {
      throw new ApiError(404, 'TENANT_NOT_FOUND', `Unknown tenant: ${slug}`);
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

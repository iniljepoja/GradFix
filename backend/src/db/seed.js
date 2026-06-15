// Seeds a demo tenant, an admin user, and a set of default categories.
// Idempotent: safe to run multiple times.
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

const DEMO = {
  tenant: { name: 'Grad Zagreb', slug: 'zagreb', centerLat: 45.8131, centerLng: 15.9776 },
  admin: { email: 'admin@gradfix.app', password: 'Admin123!', fullName: 'Demo Admin' },
  categories: [
    { name: 'Roads', slug: 'roads', icon: 'road', subs: ['Pothole', 'Damaged sidewalk'] },
    { name: 'Lighting', slug: 'lighting', icon: 'bulb', subs: ['Broken streetlight'] },
    { name: 'Waste', slug: 'waste', icon: 'trash', subs: ['Illegal dumping', 'Overflowing bin'] },
    { name: 'Signage', slug: 'signage', icon: 'sign', subs: ['Damaged sign', 'Missing sign'] },
  ],
};

async function seed() {
  const { rows: [tenant] } = await pool.query(
    `INSERT INTO tenants (name, slug, center_lat, center_lng)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [DEMO.tenant.name, DEMO.tenant.slug, DEMO.tenant.centerLat, DEMO.tenant.centerLng],
  );

  const hash = await bcrypt.hash(DEMO.admin.password, 12);
  await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_email_verified)
     VALUES ($1, $2, $3, $4, 'admin', TRUE)
     ON CONFLICT (tenant_id, email) DO NOTHING`,
    [tenant.id, DEMO.admin.email, hash, DEMO.admin.fullName],
  );

  for (const [i, cat] of DEMO.categories.entries()) {
    const { rows: [category] } = await pool.query(
      `INSERT INTO categories (tenant_id, name, slug, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tenant.id, cat.name, cat.slug, cat.icon, i],
    );
    for (const [j, subName] of cat.subs.entries()) {
      const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await pool.query(
        `INSERT INTO subcategories (category_id, name, slug, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, slug) DO NOTHING`,
        [category.id, subName, subSlug, j],
      );
    }
  }

  await pool.end();
  console.log(`Seeded tenant "${DEMO.tenant.slug}" with admin ${DEMO.admin.email} / ${DEMO.admin.password}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

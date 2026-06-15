// Seeds a demo tenant, a tenant admin, the spec category taxonomy, responsible entities,
// and default category routing. Idempotent: safe to run multiple times.
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

const DEMO = {
  tenant: { name: 'Grad Subotica', slug: 'subotica', centerLat: 46.1005, centerLng: 19.6651 },
  admin: { email: 'admin@gradfix.app', password: 'Admin123!', fullName: 'Demo Admin' },
  citizen: { email: 'citizen@gradfix.app', password: 'Citizen123!', fullName: 'Demo Citizen' },
  // Categories and subcategories per the internship specification.
  categories: [
    { name: 'Urban furniture', slug: 'urban-furniture', icon: 'bench',
      subs: ['Benches', 'Trash bins', 'Bus stops', 'Public toilets', "Children's playgrounds"] },
    { name: 'Public lighting', slug: 'public-lighting', icon: 'bulb',
      subs: ['Broken bulb', 'Damaged lamp post', 'Hanging cables'] },
    { name: 'Traffic infrastructure', slug: 'traffic-infrastructure', icon: 'sign',
      subs: ['Vertical signage', 'Horizontal road markings', 'Potholes', 'Damaged sidewalks'] },
    { name: 'Vegetation', slug: 'vegetation', icon: 'tree',
      subs: ['Overgrown branches', 'Dangerous trees', 'Overgrown passages', 'Weeds'] },
    { name: 'Other', slug: 'other', icon: 'dots',
      subs: ['Illegal dumpsites', 'Abandoned vehicles'] },
  ],
  // Responsible entities and which category routes to them by default.
  entities: [
    { name: 'City Public Utilities', type: 'company', email: 'utilities@example.com',
      routes: ['urban-furniture', 'public-lighting'] },
    { name: 'Roads & Traffic Department', type: 'department', email: 'roads@example.com',
      routes: ['traffic-infrastructure'] },
    { name: 'Parks & Greenery NGO', type: 'ngo', email: 'parks@example.com',
      routes: ['vegetation'] },
    { name: 'Sanitation Group', type: 'informal_group', email: 'sanitation@example.com',
      routes: ['other'] },
  ],
};

async function upsertUser({ tenantId, email, password, fullName, role }) {
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_email_verified)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role`,
    [tenantId, email, hash, fullName, role],
  );
}

async function seed() {
  const { rows: [tenant] } = await pool.query(
    `INSERT INTO tenants (name, slug, center_lat, center_lng)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [DEMO.tenant.name, DEMO.tenant.slug, DEMO.tenant.centerLat, DEMO.tenant.centerLng],
  );

  await upsertUser({ tenantId: tenant.id, ...DEMO.admin, role: 'tenant_admin' });
  await upsertUser({ tenantId: tenant.id, ...DEMO.citizen, role: 'citizen' });

  const categoryIdBySlug = {};
  for (const [i, cat] of DEMO.categories.entries()) {
    const { rows: [category] } = await pool.query(
      `INSERT INTO categories (tenant_id, name, slug, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon
       RETURNING id`,
      [tenant.id, cat.name, cat.slug, cat.icon, i],
    );
    categoryIdBySlug[cat.slug] = category.id;
    for (const [j, subName] of cat.subs.entries()) {
      const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await pool.query(
        `INSERT INTO subcategories (category_id, name, slug, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, slug) DO NOTHING`,
        [category.id, subName, subSlug, j],
      );
    }
  }

  for (const ent of DEMO.entities) {
    const { rows: [entity] } = await pool.query(
      `INSERT INTO responsible_entities (tenant_id, name, type, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, name) DO UPDATE SET type = EXCLUDED.type, email = EXCLUDED.email
       RETURNING id`,
      [tenant.id, ent.name, ent.type, ent.email],
    );
    const entityId = entity.id;
    for (const slug of ent.routes) {
      const categoryId = categoryIdBySlug[slug];
      if (categoryId && entityId) {
        await pool.query(
          `INSERT INTO category_routes (category_id, responsible_entity_id)
           VALUES ($1, $2)
           ON CONFLICT (category_id) DO UPDATE SET responsible_entity_id = EXCLUDED.responsible_entity_id`,
          [categoryId, entityId],
        );
      }
    }
  }

  await pool.end();
  console.log(`Seeded tenant "${DEMO.tenant.slug}":`);
  console.log(`  admin   ${DEMO.admin.email} / ${DEMO.admin.password}  (tenant_admin)`);
  console.log(`  citizen ${DEMO.citizen.email} / ${DEMO.citizen.password}  (citizen)`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

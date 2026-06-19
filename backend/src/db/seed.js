// Seeds a demo tenant, a tenant admin, the spec category taxonomy, responsible entities,
// and default category routing. Idempotent: safe to run multiple times.
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

export const DEMO = {
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
  // Demo reports across Subotica and Palić — varied categories, priorities, statuses, and support
  // counts. Coordinates are real local landmarks; the Korzo cluster (first three) sits within ~100 m
  // so the wizard's duplicate-detection panel has something to surface.
  reports: [
    { title: 'Broken streetlight on Korzo', category: 'public-lighting', priority: 'high',
      status: 'in_progress', lat: 46.1009, lng: 19.6645, address: 'Korzo, Subotica',
      upvotes: 12, daysAgo: 12,
      description: 'Ulična svetiljka u pešačkoj zoni ne radi već nekoliko večeri — Korzo je potpuno mračan nakon zalaska sunca.' },
    { title: 'Flickering lamp near City Hall', category: 'public-lighting', priority: 'medium',
      status: 'accepted', lat: 46.1013, lng: 19.6650, address: 'Trg slobode, Subotica',
      upvotes: 5, daysAgo: 6,
      description: 'The lamp by the City Hall keeps flickering and buzzing all night. Verovatno je u kvaru predspojna naprava.' },
    { title: 'Damaged bench on Korzo', category: 'urban-furniture', priority: 'low',
      status: 'new', lat: 46.1007, lng: 19.6648, address: 'Korzo, Subotica',
      upvotes: 3, daysAgo: 2,
      description: 'Drvene letve na klupi su polomljene i opasne za decu koja se tu igraju.' },
    { title: 'Large pothole on Maksima Gorkog', category: 'traffic-infrastructure', priority: 'high',
      status: 'assigned', lat: 46.0975, lng: 19.6700, address: 'Maksima Gorkog, Subotica',
      upvotes: 8, daysAgo: 9,
      description: 'Deep pothole in the right lane is damaging car tyres. Velika rupa na kolovozu kod raskrsnice.' },
    { title: 'Faded pedestrian crossing near the railway station', category: 'traffic-infrastructure',
      priority: 'medium', status: 'new', lat: 46.1040, lng: 19.6585, address: 'Bose Milićević, Subotica',
      upvotes: 1, daysAgo: 1,
      description: 'The zebra crossing markings are almost invisible. Pešački prelaz se jedva vidi, posebno noću.' },
    { title: 'Overflowing trash bins at Dudova šuma park', category: 'urban-furniture',
      priority: 'medium', status: 'in_progress', lat: 46.0930, lng: 19.6700, address: 'Park Dudova šuma, Subotica',
      upvotes: 6, daysAgo: 7,
      description: 'Kante za smeće su prepune već danima i smeće se raznosi po parku.' },
    { title: 'Fallen tree branch blocking the sidewalk', category: 'vegetation', priority: 'high',
      status: 'resolved', lat: 46.0995, lng: 19.6620, address: 'Maksima Gorkog, Subotica',
      upvotes: 4, daysAgo: 20,
      description: 'A large branch fell after the storm and blocks the pavement. Grana pala posle nevremena.' },
    { title: 'Illegal dumpsite near the allotments', category: 'other', priority: 'critical',
      status: 'accepted', lat: 46.0890, lng: 19.6550, address: 'Segedinski put, Subotica',
      upvotes: 9, daysAgo: 5,
      description: 'Neko izbacuje građevinski otpad pored bašti — gomila raste svakog dana.' },
    { title: 'Broken lamp post on the Palić promenade', category: 'public-lighting', priority: 'medium',
      status: 'new', lat: 46.0982, lng: 19.7662, address: 'Obala lavova, Palić',
      upvotes: 2, daysAgo: 3,
      description: 'Stub ulične rasvete na šetalištu pored jezera je oštećen i opasno nagnut.' },
    { title: 'Damaged bench by Palić Lake', category: 'urban-furniture', priority: 'low',
      status: 'closed', lat: 46.0997, lng: 19.7669, address: 'Park na Paliću, Palić',
      upvotes: 2, daysAgo: 30,
      description: 'Klupa na šetalištu pored jezera je polomljena. The bench by the lake is broken.' },
    { title: 'Overgrown bushes blocking the path to the beach', category: 'vegetation',
      priority: 'medium', status: 'assigned', lat: 46.1015, lng: 19.7650, address: 'Ženska plaža, Palić',
      upvotes: 5, daysAgo: 8,
      description: 'Žbunje i korov potpuno su zakrčili stazu prema ženskoj plaži.' },
    { title: 'Abandoned vehicle near the Palić Zoo', category: 'other', priority: 'low',
      status: 'new', lat: 46.1000, lng: 19.7600, address: 'Zoološki vrt, Palić',
      upvotes: 1, daysAgo: 4,
      description: 'Napušteno vozilo bez registarskih tablica stoji na parkingu već nedeljama.' },
  ],
};

// Canonical status path; demo reports get a history chain from `new` up to their final status.
const STATUS_PATH = ['new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed'];
const TRANSITION_NOTE = {
  accepted: 'Report reviewed and accepted. / Prijava prihvaćena.',
  assigned: 'Assigned to the responsible department. / Prosleđeno nadležnoj službi.',
  in_progress: 'Field crew dispatched. / Ekipa upućena na teren.',
  resolved: 'Issue fixed and verified. / Kvar otklonjen.',
  closed: 'Closed after confirmation. / Zatvoreno nakon potvrde.',
};
export function historyChain(finalStatus) {
  const idx = STATUS_PATH.indexOf(finalStatus);
  const chain = [];
  for (let i = 1; i <= idx; i += 1) chain.push({ from: STATUS_PATH[i - 1], to: STATUS_PATH[i] });
  return chain;
}

async function upsertUser({ tenantId, email, password, fullName, role }) {
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_email_verified)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role`,
    [tenantId, email, hash, fullName, role],
  );
}

// Inserts the demo reports with their status-history chains. Idempotent: skips if the tenant already
// has reports, so re-running the seed never duplicates them (and never touches real user reports).
async function seedReports(tenantId, categoryIdBySlug, routeEntityByCategoryId) {
  const { rows: [{ n }] } = await pool.query(
    'SELECT count(*)::int AS n FROM reports WHERE tenant_id = $1', [tenantId]);
  if (n > 0) {
    console.log(`  reports skipped (${n} already present)`);
    return;
  }

  const { rows: [citizen] } = await pool.query(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, DEMO.citizen.email]);
  const { rows: [admin] } = await pool.query(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, DEMO.admin.email]);

  const DAY = 86400000;
  for (const r of DEMO.reports) {
    const created = new Date(Date.now() - r.daysAgo * DAY);
    const resolvedAt = ['resolved', 'closed'].includes(r.status)
      ? new Date(created.getTime() + 3 * DAY) : null;
    const closedAt = r.status === 'closed' ? new Date(created.getTime() + 5 * DAY) : null;
    const categoryId = categoryIdBySlug[r.category];
    const assignedEntityId = routeEntityByCategoryId[categoryId] ?? null;

    const { rows: [report] } = await pool.query(
      `INSERT INTO reports
         (tenant_id, reporter_id, category_id, title, description, status, priority,
          latitude, longitude, address, upvote_count, assigned_entity_id,
          created_at, updated_at, resolved_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$15)
       RETURNING id`,
      [tenantId, citizen.id, categoryId, r.title, r.description, r.status, r.priority,
        r.lat, r.lng, r.address, r.upvotes, assignedEntityId,
        created.toISOString(), resolvedAt && resolvedAt.toISOString(), closedAt && closedAt.toISOString()],
    );

    for (const [i, t] of historyChain(r.status).entries()) {
      const at = new Date(created.getTime() + (i + 1) * DAY);
      await pool.query(
        `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [report.id, admin.id, t.from, t.to, TRANSITION_NOTE[t.to] ?? null, at.toISOString()],
      );
    }
  }
  console.log(`  reports ${DEMO.reports.length} demo reports inserted (Subotica + Palić)`);
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

  const routeEntityByCategoryId = {};
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
        routeEntityByCategoryId[categoryId] = entityId;
      }
    }
  }

  await seedReports(tenant.id, categoryIdBySlug, routeEntityByCategoryId);

  await pool.end();
  console.log(`Seeded tenant "${DEMO.tenant.slug}":`);
  console.log(`  admin   ${DEMO.admin.email} / ${DEMO.admin.password}  (tenant_admin)`);
  console.log(`  citizen ${DEMO.citizen.email} / ${DEMO.citizen.password}  (citizen)`);
}

// Only run when executed directly (`node src/db/seed.js` / `npm run seed`), so the module can be
// imported for tests/verification without opening a DB connection.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

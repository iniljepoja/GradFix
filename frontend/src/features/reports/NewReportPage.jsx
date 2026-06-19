import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import * as reportsApi from '../../api/reports.js';
import * as categoriesApi from '../../api/categories.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { compressImage } from '../../lib/imageCompression.js';
import Field from '../../components/Field.jsx';
import Spinner from '../../components/Spinner.jsx';
import LocationPicker from '../map/LocationPicker.jsx';
import NearbyReports from './NearbyReports.jsx';

const MAX_PHOTOS = 3;
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STEPS = ['Photos', 'Location', 'Category', 'Details', 'Review'];

export default function NewReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]); // { file, url }
  const [photoBusy, setPhotoBusy] = useState(false);
  const [location, setLocation] = useState(null); // { lat, lng }
  const [form, setForm] = useState({
    categoryId: '', subcategoryId: '', title: '', description: '', address: '', priority: 'medium',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Reports the user has marked "I have this problem too" → id → latest affected count. Shared
  // across the Location and Category panels so the support state stays consistent between steps.
  const [supported, setSupported] = useState(new Map());
  const onSupport = (id, count) => setSupported((m) => new Map(m).set(id, count));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Revoke object URLs on unmount to avoid leaking memory.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const subcategoriesQuery = useQuery({
    queryKey: ['subcategories', form.categoryId],
    queryFn: () => categoriesApi.listSubcategories(form.categoryId),
    enabled: !!form.categoryId,
  });

  const addPhotos = async (fileList) => {
    setError('');
    const incoming = Array.from(fileList).slice(0, MAX_PHOTOS - photos.length);
    if (!incoming.length) return;
    setPhotoBusy(true);
    try {
      const processed = await Promise.all(incoming.map(async (file) => {
        const compressed = await compressImage(file);
        return { file: compressed, url: URL.createObjectURL(compressed) };
      }));
      setPhotos((prev) => [...prev, ...processed].slice(0, MAX_PHOTOS));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const category = categoriesQuery.data?.find((c) => c.id === form.categoryId);
  const subcategory = subcategoriesQuery.data?.find((s) => s.id === form.subcategoryId);

  // What blocks "Next" / "Submit" on the current step (null === ready to advance).
  const stepError = (() => {
    switch (step) {
      case 0: return photos.length === 0 ? 'Add at least one photo.' : null;
      case 1: return location ? null : 'Set the location of the problem.';
      case 2: return form.categoryId ? null : 'Choose a category.';
      case 3: return form.title.trim().length < 3 ? 'Give the report a title (at least 3 characters).' : null;
      default: return null;
    }
  })();

  const next = () => {
    if (stepError) { setError(stepError); return; }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const onCategoryChange = (e) => {
    // Changing the category invalidates any previously picked subcategory.
    setForm((f) => ({ ...f, categoryId: e.target.value, subcategoryId: '' }));
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append('photos', p.file));
      fd.append('title', form.title.trim());
      if (form.description.trim()) fd.append('description', form.description.trim());
      fd.append('categoryId', form.categoryId);
      if (form.subcategoryId) fd.append('subcategoryId', form.subcategoryId);
      fd.append('latitude', String(location.lat));
      fd.append('longitude', String(location.lng));
      if (form.address.trim()) fd.append('address', form.address.trim());
      fd.append('priority', form.priority);

      await reportsApi.create(fd);
      await queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      refreshProfile().catch(() => { /* badge refresh is best-effort */ });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit your report. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="page stack">
      <h1>Report a problem</h1>

      <div className="stepper">
        {STEPS.map((label, i) => (
          <div key={label} className={`step ${i === step ? 'step-active' : ''} ${i < step ? 'step-done' : ''}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card stack">
        {step === 0 && (
          <PhotosStep
            photos={photos} busy={photoBusy} onAdd={addPhotos} onRemove={removePhoto} />
        )}

        {step === 1 && (
          <div className="stack">
            <h2>Where is it?</h2>
            <LocationPicker value={location} onChange={setLocation} />
            <Field label="Address or landmark (optional)" id="address"
              placeholder="e.g. Ilica 5, near the tram stop"
              value={form.address} onChange={set('address')} />
            <NearbyReports location={location} onContinue={next}
              supported={supported} onSupport={onSupport} />
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <h2>What kind of problem?</h2>
            {categoriesQuery.isLoading && <Spinner />}
            {categoriesQuery.isError && <div className="alert alert-error">Could not load categories.</div>}
            {categoriesQuery.data && (
              <>
                <Field label="Category" id="categoryId" as="custom">
                  <select id="categoryId" className="input" value={form.categoryId} onChange={onCategoryChange}>
                    <option value="">Select a category…</option>
                    {categoriesQuery.data.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>

                {form.categoryId && (
                  <Field label="Subcategory (optional)" id="subcategoryId" as="custom"
                    hint={subcategoriesQuery.isLoading ? 'Loading…' : undefined}>
                    <select id="subcategoryId" className="input" value={form.subcategoryId}
                      onChange={set('subcategoryId')}
                      disabled={subcategoriesQuery.isLoading || !subcategoriesQuery.data?.length}>
                      <option value="">
                        {subcategoriesQuery.data?.length ? 'No specific subcategory' : 'None available'}
                      </option>
                      {subcategoriesQuery.data?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}

            {form.categoryId && (
              <NearbyReports location={location} categorySlug={category?.slug} onContinue={next}
                supported={supported} onSupport={onSupport} />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <h2>Describe it</h2>
            <Field label="Title" id="title" required
              placeholder="Short summary, e.g. Broken streetlight on Ilica"
              value={form.title} onChange={set('title')} />
            <Field label="Description (optional)" id="description" as="custom"
              hint="Add any detail that helps the city locate and fix the problem.">
              <textarea id="description" className="input" rows={5}
                value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Priority" id="priority" as="custom">
              <select id="priority" className="input" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {step === 4 && (
          <ReviewStep
            photos={photos} location={location}
            category={category} subcategory={subcategory} form={form} />
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <button type="button" className="btn" onClick={back} disabled={step === 0 || submitting}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next} disabled={photoBusy}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotosStep({ photos, busy, onAdd, onRemove }) {
  return (
    <div className="stack">
      <h2>Add photos</h2>
      <p className="field-hint">At least one photo is required (up to {MAX_PHOTOS}). They are compressed before upload.</p>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div className="photo-thumb" key={p.url}>
            <img src={p.url} alt={`Photo ${i + 1}`} />
            <button type="button" className="photo-remove" aria-label="Remove photo" onClick={() => onRemove(i)}>
              ×
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="photo-add">
            {busy ? 'Processing…' : '+ Add'}
            <input type="file" accept="image/*" capture="environment" multiple hidden
              onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ photos, location, category, subcategory, form }) {
  return (
    <div className="stack">
      <h2>Review &amp; submit</h2>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div className="photo-thumb" key={p.url}><img src={p.url} alt={`Photo ${i + 1}`} /></div>
        ))}
      </div>
      <dl className="stack" style={{ margin: 0 }}>
        <ReviewRow label="Title" value={form.title} />
        <ReviewRow label="Category"
          value={[category?.name, subcategory?.name].filter(Boolean).join(' › ') || '—'} />
        <ReviewRow label="Priority" value={form.priority[0].toUpperCase() + form.priority.slice(1)} />
        <ReviewRow label="Location"
          value={location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '—'} />
        {form.address.trim() && <ReviewRow label="Address" value={form.address.trim()} />}
        {form.description.trim() && <ReviewRow label="Description" value={form.description.trim()} />}
      </dl>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="report-item" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
      <strong style={{ minWidth: 110 }}>{label}</strong>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

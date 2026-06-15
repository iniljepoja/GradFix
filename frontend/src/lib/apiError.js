// Extracts a human-readable message from an axios error against the GradFix API
// (which returns { error: { code, message, details } } on failure).
export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export function apiErrorCode(err) {
  return err?.response?.data?.error?.code || null;
}

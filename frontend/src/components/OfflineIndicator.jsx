import { useEffect, useState } from 'react';

// Shows a banner when the browser loses connectivity. Cached map tiles and the app shell still work
// offline (via the service worker), so this is an informational cue rather than a hard block.
export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      You’re offline — showing cached data.
    </div>
  );
}

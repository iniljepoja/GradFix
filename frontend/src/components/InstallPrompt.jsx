import { useEffect, useState } from 'react';

// Surfaces an "Install" affordance once the browser fires `beforeinstallprompt`. The event only
// fires when the PWA is installable and not already installed, so the banner is self-gating.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setDismissed(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || dismissed) return null;

  const install = async () => {
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* user dismissed */ }
    setDeferred(null);
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Install GradFix">
      <span>Install GradFix for quick access and offline maps.</span>
      <span className="install-actions">
        <button className="btn btn-primary btn-sm" onClick={install}>Install</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(true)}>Not now</button>
      </span>
    </div>
  );
}

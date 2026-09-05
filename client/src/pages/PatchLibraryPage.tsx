import { useNavigate } from 'react-router-dom';

import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

export function PatchLibraryPage() {
  const navigate = useNavigate();
  const { sessionReady, patches, loadPatch } = usePatchWorkspace();

  if (!sessionReady) {
    return (
      <main className="shell__canvas library">
        <header className="library__header">
          <h1 className="library__title">Patch Library</h1>
          <p className="library__lede">Sign in to list your Patches.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="shell__canvas library">
      <header className="library__header">
        <h1 className="library__title">Patch Library</h1>
        <p className="library__lede">Your saved Patches. Open one to edit it on the canvas.</p>
      </header>
      {patches.length === 0 ? (
        <p className="library__empty">No Patches yet. Save one from the canvas.</p>
      ) : (
        <ul className="library__list">
          {patches.map((patch) => (
            <li key={patch.id}>
              <button
                type="button"
                className="library__row"
                onClick={() => {
                  void loadPatch(patch.id).then(() => {
                    navigate('/');
                  });
                }}
              >
                <span className="library__row-label">{patch.name}</span>
                <span className="library__row-desc">{patch.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

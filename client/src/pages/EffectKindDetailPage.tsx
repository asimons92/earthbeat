import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getEffectKind } from '@/generated/catalog';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

export function EffectKindDetailPage() {
  const { kindKey = '' } = useParams();
  const navigate = useNavigate();
  const { addEffect, activePatchId, sessionReady, createPatch, activePatchName } =
    usePatchWorkspace();
  const kind = getEffectKind(kindKey);

  if (!kind) {
    return (
      <main className="shell__canvas library">
        <header className="library__header">
          <h1 className="library__title">Unknown EffectKind</h1>
          <p className="library__lede">No catalog entry matches this key.</p>
        </header>
      </main>
    );
  }

  const onAddToCanvas = async () => {
    try {
      if (!activePatchId && sessionReady) {
        await createPatch(activePatchName.trim() || 'Untitled Patch');
      }
    } catch {
      // Still place the Effect locally if Patch create or save fails.
    }
    const added = addEffect(kind.key);
    if (added) {
      navigate('/');
    }
  };

  return (
    <main className="shell__canvas library">
      <header className="library__header">
        <h1 className="library__title">{kind.label}</h1>
        <p className="library__lede">{kind.description}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void onAddToCanvas()}>
          Add to canvas
        </Button>
      </header>
      <section className="library__section" aria-label="Transforms">
        <h2 className="library__section-title">Transforms</h2>
        <ul className="library__list">
          {kind.transforms.map((param) => (
            <li key={param} className="library__row library__row--static">
              <span className="library__row-label">{param}</span>
              <span className="library__row-desc">Oscillator parameter</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getConnectorKind } from '@/generated/catalog';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

export function ConnectorKindDetailPage() {
  const { kindKey = '' } = useParams();
  const navigate = useNavigate();
  const { addConnector, activePatchId, sessionReady, createPatch, activePatchName } =
    usePatchWorkspace();
  const kind = getConnectorKind(kindKey);

  if (!kind) {
    return (
      <main className="shell__canvas library">
        <header className="library__header">
          <h1 className="library__title">Unknown ConnectorKind</h1>
          <p className="library__lede">No catalog entry matches this key.</p>
        </header>
      </main>
    );
  }

  const onAddToCanvas = async () => {
    if (!activePatchId && sessionReady) {
      await createPatch(activePatchName.trim() || 'Untitled Patch');
    }
    const added = addConnector(kind.key);
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
      <section className="library__section" aria-label="Channels">
        <h2 className="library__section-title">Channels</h2>
        <ul className="library__list">
          {kind.channels.map((channel) => (
            <li key={channel.key} className="library__row library__row--static">
              <span className="library__row-label">{channel.label}</span>
              <span className="library__row-desc">
                {channel.key}
                {'unit' in channel && channel.unit ? ` · ${channel.unit}` : ''}
                {channel.modulatable ? ' · modulatable' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

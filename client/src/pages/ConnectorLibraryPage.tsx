import { Link } from 'react-router-dom';

import { connectorKinds } from '@/generated/catalog';

export function ConnectorLibraryPage() {
  return (
    <main className="shell__canvas library">
      <header className="library__header">
        <h1 className="library__title">Connector Library</h1>
        <p className="library__lede">
          Catalog of ConnectorKinds (natural-signal API kinds). Choose one to add to the active
          Patch.
        </p>
      </header>
      <ul className="library__list">
        {connectorKinds.map((kind) => (
          <li key={kind.key}>
            <Link className="library__row" to={`/connectors/${kind.key}`}>
              <span className="library__row-label">{kind.label}</span>
              <span className="library__row-desc">{kind.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

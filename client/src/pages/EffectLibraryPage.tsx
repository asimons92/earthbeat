import { Link } from 'react-router-dom';

import { effectKinds } from '@/generated/catalog';

export function EffectLibraryPage() {
  return (
    <main className="shell__canvas library">
      <header className="library__header">
        <h1 className="library__title">Effect Library</h1>
        <p className="library__lede">
          Catalog of EffectKinds (post-map transforms on the path into an Oscillator). Choose one to
          add to the active Patch.
        </p>
      </header>
      <ul className="library__list">
        {effectKinds.map((kind) => (
          <li key={kind.key}>
            <Link className="library__row" to={`/effects/${kind.key}`}>
              <span className="library__row-label">{kind.label}</span>
              <span className="library__row-desc">{kind.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

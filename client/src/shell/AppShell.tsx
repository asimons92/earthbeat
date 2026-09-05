import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  oscillatorDefaults,
  shellAuthActions,
  shellCreateActions,
  shellNavItems,
} from '@/generated/catalog';
import { decideAuthChrome } from '@/persist/sessionBootstrap';
import { startGoogleSignIn, startSignOut } from '@/persist/authActions';
import { ThemeToggle } from '@/theme/ThemeToggle';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

function persistLabel(status: string) {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  if (status === 'conflict') return 'Version conflict';
  if (status === 'error') return 'Save failed';
  return 'Not saved';
}

export function AppShell() {
  const navigate = useNavigate();
  const {
    sessionReady,
    authMode,
    patches,
    activePatchId,
    activePatchName,
    persistStatus,
    saveNow,
    createPatch,
    loadPatch,
    resolveConflictByReload,
    addModulator,
    addOscillator,
    liveStatus,
    lastSample,
    playAllOscillators,
    stopAllOscillators,
  } = usePatchWorkspace();

  const authChrome = decideAuthChrome({ authMode, sessionReady });
  const googleSignInAction = shellAuthActions.find((action) => action.key === 'google_sign_in');
  const signOutAction = shellAuthActions.find((action) => action.key === 'sign_out');

  const onSaveClick = async () => {
    if (!sessionReady) {
      window.alert('Sign in to save a Patch.');
      return;
    }
    if (!activePatchId) {
      const name = window.prompt('Patch name', activePatchName) ?? activePatchName;
      await createPatch(name.trim() || 'Untitled Patch');
      return;
    }
    await saveNow();
  };

  const onSelectPatch = async (patchId: string) => {
    if (!patchId) return;
    await loadPatch(patchId);
  };

  return (
    <div className="shell">
      <header className="shell__header">
        <Link className="shell__brand" to="/">
          EARTHBEAT
        </Link>
        <div className="shell__create">
          {shellCreateActions.map((action) => {
            const onClick =
              action.nodeType === 'connector'
                ? () => {
                    navigate('/connectors');
                  }
                : action.nodeType === 'modulator'
                  ? addModulator
                  : addOscillator;
            return (
              <Button
                key={action.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={onClick}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
        <label className="shell__patch-select">
          <span className="visually-hidden">Active patch</span>
          <select
            value={activePatchId ?? ''}
            aria-label="Active patch"
            onChange={(event) => {
              void onSelectPatch(event.target.value);
            }}
          >
            <option value="">{activePatchName}</option>
            {patches.map((patch) => (
              <option key={patch.id} value={patch.id}>
                {patch.name}
              </option>
            ))}
          </select>
        </label>
        <div className="shell__transport">
          {authChrome === 'signIn' && googleSignInAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void startGoogleSignIn().catch(() => {
                  window.alert('Google sign-in failed to start.');
                });
              }}
            >
              {googleSignInAction.label}
            </Button>
          ) : null}
          {authChrome === 'signOut' && signOutAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void startSignOut().catch(() => {
                  window.alert('Sign out failed.');
                });
              }}
            >
              {signOutAction.label}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void onSaveClick()}>
            Save
          </Button>
          <span className="shell__persist-status" data-status={persistStatus}>
            {persistLabel(persistStatus)}
          </span>
          {persistStatus === 'conflict' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void resolveConflictByReload()}
            >
              Reload
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={playAllOscillators}
            aria-label="Play all oscillators"
          >
            ▶
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={stopAllOscillators}
            aria-label="Stop all oscillators"
          >
            ■
          </Button>
          <span
            className={
              liveStatus === 'live'
                ? 'live-badge live-badge--on'
                : liveStatus === 'error'
                  ? 'live-badge live-badge--error'
                  : liveStatus === 'connecting'
                    ? 'live-badge live-badge--connecting'
                    : 'live-badge'
            }
            title={
              liveStatus === 'live'
                ? 'USGS stream connected'
                : liveStatus === 'error'
                  ? 'USGS stream error — retrying'
                  : liveStatus === 'connecting'
                    ? 'Connecting to USGS stream'
                    : 'Live feed idle'
            }
          >
            <span className="live-badge__dot" />
            LIVE
          </span>
        </div>
      </header>

      <div className="shell__body">
        <nav className="shell__sidebar" aria-label="Primary">
          {shellNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive ? 'shell__nav-link shell__nav-link--active' : 'shell__nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>

      <section className="shell__monitor" aria-label="Output monitor">
        <div className="monitor__meta">
          <div className="monitor__title">Output monitor</div>
          <div className="monitor__readout">
            <span>
              {lastSample?.mag != null
                ? `M ${lastSample.mag}`
                : `${oscillatorDefaults.frequencyHz} Hz`}
            </span>
            <span>{lastSample?.place ?? 'Waiting for samples'}</span>
          </div>
        </div>
        <svg className="monitor__wave" viewBox="0 0 800 80" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 40 C 50 10, 100 70, 150 40 S 250 10, 300 40 S 400 70, 450 40 S 550 10, 600 40 S 700 70, 800 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <div className="monitor__time">2.35 s</div>
      </section>

      <footer className="shell__footer" aria-label="Patches">
        {patches.map((patch) => (
          <button
            key={patch.id}
            type="button"
            className={
              patch.id === activePatchId ? 'patch-tab patch-tab--active' : 'patch-tab'
            }
            onClick={() => {
              void loadPatch(patch.id);
            }}
          >
            {patch.name}
          </button>
        ))}
        <button
          type="button"
          className="patch-tab patch-tab--new"
          aria-label="New patch"
          onClick={() => {
            if (!sessionReady) {
              window.alert('Sign in to save a Patch.');
              return;
            }
            void createPatch(`Patch ${patches.length + 1}`);
          }}
        >
          +
        </button>
      </footer>

      <ThemeToggle />
    </div>
  );
}

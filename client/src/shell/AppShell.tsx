import { useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  shellAuthActions,
  shellCreateActions,
  shellNavItems,
  shellPatchFileActions,
} from '@/generated/catalog';
import { decideShareOffer } from '@/persist/shareSession';
import { decideAuthChrome } from '@/persist/sessionBootstrap';
import {
  decideDirtyNavigation,
  decideSaveRoute,
  shouldShowPatchFileActions,
} from '@/persist/patchFileActions';
import { startGoogleSignIn, startSignOut } from '@/persist/authActions';
import { ThemeToggle } from '@/theme/ThemeToggle';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';
import { OutputMonitor } from '@/shell/OutputMonitor';
import { DiscardChangesDialog, PatchNameDialog, SharePatchDialog } from '@/shell/PatchFileDialogs';
import { ShareVisit } from '@/shell/ShareVisit';

function persistLabel(status: string) {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  if (status === 'conflict') return 'Version conflict';
  if (status === 'error') return 'Save failed';
  if (status === 'draft_error') return 'Draft not stored';
  return 'Not saved';
}

type NameDialogMode = 'save' | 'saveAs' | null;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCanvas = shouldShowPatchFileActions(location.pathname);
  const {
    sessionReady,
    authMode,
    activePatchId,
    activePatchName,
    persistStatus,
    isDirty,
    saveNow,
    createPatch,
    resolveConflictByReload,
    addModulator,
    addOscillator,
    liveStatus,
    lastSample,
    lastSamplesByKind,
    monitorStrips,
    sampleHistoryByStripId,
    playStartedAtMs,
    isPlaying,
    getTimeDomainSnapshot,
    playAllOscillators,
    stopAllOscillators,
    newBlankPatch,
    blankForSignOut,
    graphLocked,
    shareVisit,
    publishShare,
    revokeShare,
  } = usePatchWorkspace();

  const [discardOpen, setDiscardOpen] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<NameDialogMode>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const shareBusyRef = useRef(false);
  const shareEpochRef = useRef(0);

  const authChrome = decideAuthChrome({ authMode, sessionReady });
  const googleSignInAction = shellAuthActions.find((action) => action.key === 'google_sign_in');
  const signOutAction = shellAuthActions.find((action) => action.key === 'sign_out');

  const fileActions = useMemo(
    () => ({
      new: shellPatchFileActions.find((action) => action.key === 'new'),
      save: shellPatchFileActions.find((action) => action.key === 'save'),
      saveAs: shellPatchFileActions.find((action) => action.key === 'saveAs'),
      share: shellPatchFileActions.find((action) => action.key === 'share'),
      stopSharing: shellPatchFileActions.find((action) => action.key === 'stopSharing'),
      copyLink: shellPatchFileActions.find((action) => action.key === 'copyLink'),
      sharedMark: shellPatchFileActions.find((action) => action.key === 'sharedMark'),
    }),
    [],
  );

  const shareOffer = decideShareOffer(
    graphLocked
      ? { kind: 'shared' }
      : { kind: 'owned', patchId: activePatchId },
  );

  const publishLink = async () => {
    if (shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareBusy(true);
    setShareFailed(false);
    const startedEpoch = shareEpochRef.current;
    let published: { shareToken: string } | undefined;
    try {
      published = await publishShare();
    } catch {
      published = undefined;
    }
    if (shareEpochRef.current !== startedEpoch) {
      try {
        await revokeShare();
      } catch {
        // Stop already asked for the link to be off.
      }
      shareBusyRef.current = false;
      setShareBusy(false);
      setShareLink(null);
      return;
    }
    shareBusyRef.current = false;
    setShareBusy(false);
    if (!published) {
      setShareLink(null);
      setShareFailed(true);
      return;
    }
    const url = new URL(`/share/${published.shareToken}`, window.location.origin);
    setShareLink(url.href);
  };

  const onShareClick = () => {
    if (shareBusyRef.current) return;
    setShareOpen(true);
    void publishLink();
  };

  const onStopShare = () => {
    shareEpochRef.current += 1;
    setShareLink(null);
    setShareFailed(false);
    if (shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareBusy(true);
    void revokeShare()
      .then((result) => {
        if (!result) setShareFailed(true);
      })
      .finally(() => {
        shareBusyRef.current = false;
        setShareBusy(false);
      });
  };

  const runNew = () => {
    newBlankPatch();
  };

  const onNewClick = () => {
    if (decideDirtyNavigation(isDirty, 'new') === 'prompt') {
      setDiscardOpen(true);
      return;
    }
    runNew();
  };

  const onSaveClick = () => {
    if (!sessionReady) {
      window.alert('Sign in to save a Patch.');
      return;
    }
    if (decideSaveRoute('save', activePatchId) === 'nameThenCreate') {
      setNameDialogMode('save');
      return;
    }
    void saveNow();
  };

  const onSaveAsClick = () => {
    if (!sessionReady) {
      window.alert('Sign in to save a Patch.');
      return;
    }
    setNameDialogMode('saveAs');
  };

  const onNameConfirm = async (name: string) => {
    setNameDialogMode(null);
    await createPatch(name);
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
                : action.nodeType === 'effect'
                  ? () => {
                      navigate('/effects');
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
        <div className="shell__center">
          <span className="shell__patch-name" aria-live="polite">
            {activePatchName}
          </span>
          <div className="shell__transport-center">
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
          </div>
        </div>
        <div className="shell__transport">
          {isCanvas ? (
            <>
              {fileActions.new ? (
                <Button type="button" variant="outline" size="sm" onClick={onNewClick}>
                  {fileActions.new.label}
                </Button>
              ) : null}
              {fileActions.save ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onSaveClick()}
                >
                  {fileActions.save.label}
                </Button>
              ) : null}
              {fileActions.saveAs ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onSaveAsClick()}
                >
                  {fileActions.saveAs.label}
                </Button>
              ) : null}
              {fileActions.share && shareOffer === 'offer' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onShareClick}
                  disabled={shareBusy}
                >
                  {fileActions.share.label}
                </Button>
              ) : null}
            </>
          ) : null}
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
                blankForSignOut();
                void startSignOut().catch(() => {
                  window.alert('Sign out failed.');
                });
              }}
            >
              {signOutAction.label}
            </Button>
          ) : null}
          <span className="shell__persist-status" data-status={persistStatus}>
            {shareVisit && fileActions.sharedMark
              ? fileActions.sharedMark.label
              : persistLabel(persistStatus)}
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
                ? 'Live connector streams connected'
                : liveStatus === 'error'
                  ? 'Live stream error — retrying'
                  : liveStatus === 'connecting'
                    ? 'Connecting to live streams'
                    : 'Live feed idle'
            }
          >
            <span className="live-badge__dot" />
            LIVE
          </span>
        </div>
      </header>

      <div className={graphLocked ? 'shell__body shell__body--locked' : 'shell__body'}>
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

      <OutputMonitor
        lastSample={lastSample}
        lastSamplesByKind={lastSamplesByKind}
        monitorStrips={monitorStrips}
        sampleHistoryByStripId={sampleHistoryByStripId}
        playStartedAtMs={playStartedAtMs}
        isPlaying={isPlaying}
        getTimeDomainSnapshot={getTimeDomainSnapshot}
      />

      <ThemeToggle />

      <DiscardChangesDialog
        open={discardOpen}
        onStay={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          runNew();
        }}
      />

      <ShareVisit />

      <SharePatchDialog
        open={shareOpen}
        link={shareLink}
        busy={shareBusy}
        failed={shareFailed}
        shareLabel={fileActions.share?.label ?? ''}
        stopLabel={fileActions.stopSharing?.label ?? ''}
        copyLabel={fileActions.copyLink?.label ?? ''}
        onClose={() => setShareOpen(false)}
        onPublish={() => {
          void publishLink();
        }}
        onStop={onStopShare}
        onCopy={() => {
          if (!shareLink) return;
          void navigator.clipboard.writeText(shareLink);
        }}
      />

      <PatchNameDialog
        open={nameDialogMode !== null}
        title={nameDialogMode === 'saveAs' ? 'Save As' : 'Save Patch'}
        description={
          nameDialogMode === 'saveAs'
            ? 'Create a new Patch from the current graph.'
            : 'Name this Patch before the first save.'
        }
        initialName={activePatchName}
        onCancel={() => setNameDialogMode(null)}
        onConfirm={(name) => {
          void onNameConfirm(name);
        }}
      />
    </div>
  );
}

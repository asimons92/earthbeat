import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { shellPatchFileActions } from '@/generated/catalog';
import { decideDirtyNavigation } from '@/persist/patchFileActions';
import { DeletePatchDialog, DiscardChangesDialog } from '@/shell/PatchFileDialogs';
import {
  buildPatchLibraryEntries,
  listStarterPatches,
} from '@/starters/starterLibrary';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

type PendingOpen =
  | { kind: 'starter'; key: string }
  | { kind: 'user'; id: string };

export function PatchLibraryPage() {
  const navigate = useNavigate();
  const {
    sessionReady,
    patches,
    loadPatch,
    loadStarter,
    deletePatch,
    isDirty,
  } = usePatchWorkspace();

  const deleteAction = shellPatchFileActions.find((action) => action.key === 'delete');

  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    version: number;
  } | null>(null);

  const entries = buildPatchLibraryEntries({
    starters: listStarterPatches().map((starter) => ({
      key: starter.key,
      name: starter.name,
    })),
    userPatches: sessionReady
      ? patches.map((patch) => ({
          id: patch.id,
          name: patch.name,
          version: Number(patch.version),
        }))
      : null,
  });

  const starterEntries = entries.filter((entry) => entry.kind === 'starter');
  const userEntries = entries.filter((entry) => entry.kind === 'user');

  const openStarter = (key: string) => {
    loadStarter(key);
    navigate('/');
  };

  const openUserPatch = async (id: string) => {
    await loadPatch(id);
    navigate('/');
  };

  const onStarterClick = (key: string) => {
    if (decideDirtyNavigation(isDirty, 'load') === 'prompt') {
      setPendingOpen({ kind: 'starter', key });
      return;
    }
    openStarter(key);
  };

  const onUserClick = (id: string) => {
    if (decideDirtyNavigation(isDirty, 'load') === 'prompt') {
      setPendingOpen({ kind: 'user', id });
      return;
    }
    void openUserPatch(id);
  };

  return (
    <main className="shell__canvas library">
      <header className="library__header">
        <h1 className="library__title">Patch Library</h1>
        <p className="library__lede">
          {sessionReady
            ? 'Starters and your saved Patches. Open one to edit it on the canvas.'
            : 'Starters are open to everyone. Sign in to list and save your own Patches.'}
        </p>
      </header>

      <section className="library__section">
        <h2 className="library__section-title">Starters</h2>
        <ul className="library__list">
          {starterEntries.map((entry) =>
            entry.kind === 'starter' ? (
              <li key={entry.key} className="library__row-wrap">
                <button
                  type="button"
                  className="library__row"
                  onClick={() => {
                    onStarterClick(entry.key);
                  }}
                >
                  <span className="library__row-label">{entry.name}</span>
                  <span className="library__row-desc">{entry.key}</span>
                </button>
              </li>
            ) : null,
          )}
        </ul>
      </section>

      <section className="library__section">
        <h2 className="library__section-title">Your Patches</h2>
        {!sessionReady ? (
          <p className="library__empty">Sign in to list Patches you own.</p>
        ) : userEntries.length === 0 ? (
          <p className="library__empty">No Patches yet. Save one from the canvas.</p>
        ) : (
          <ul className="library__list">
            {userEntries.map((entry) =>
              entry.kind === 'user' ? (
                <li key={entry.id} className="library__row-wrap">
                  <button
                    type="button"
                    className="library__row"
                    onClick={() => {
                      onUserClick(entry.id);
                    }}
                  >
                    <span className="library__row-label">{entry.name}</span>
                    <span className="library__row-desc">{entry.id}</span>
                  </button>
                  {deleteAction ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="library__row-action"
                      onClick={() => {
                        setDeleteTarget({
                          id: entry.id,
                          name: entry.name,
                          version: entry.version,
                        });
                      }}
                    >
                      {deleteAction.label}
                    </Button>
                  ) : null}
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      <DiscardChangesDialog
        open={pendingOpen !== null}
        onStay={() => setPendingOpen(null)}
        onDiscard={() => {
          const target = pendingOpen;
          setPendingOpen(null);
          if (!target) return;
          if (target.kind === 'starter') {
            openStarter(target.key);
            return;
          }
          void openUserPatch(target.id);
        }}
      />

      <DeletePatchDialog
        open={deleteTarget !== null}
        patchName={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (!target) return;
          void deletePatch(target.id, target.version).catch(() => {
            window.alert('Delete failed.');
          });
        }}
      />
    </main>
  );
}

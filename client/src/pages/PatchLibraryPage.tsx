import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { shellPatchFileActions } from '@/generated/catalog';
import { decideDirtyNavigation } from '@/persist/patchFileActions';
import { DeletePatchDialog, DiscardChangesDialog } from '@/shell/PatchFileDialogs';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

export function PatchLibraryPage() {
  const navigate = useNavigate();
  const {
    sessionReady,
    patches,
    loadPatch,
    deletePatch,
    isDirty,
  } = usePatchWorkspace();

  const deleteAction = shellPatchFileActions.find((action) => action.key === 'delete');

  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    version: number;
  } | null>(null);

  const openPatch = async (id: string) => {
    await loadPatch(id);
    navigate('/');
  };

  const onOpenClick = (id: string) => {
    if (decideDirtyNavigation(isDirty, 'load') === 'prompt') {
      setPendingOpenId(id);
      return;
    }
    void openPatch(id);
  };

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
            <li key={patch.id} className="library__row-wrap">
              <button
                type="button"
                className="library__row"
                onClick={() => {
                  onOpenClick(patch.id);
                }}
              >
                <span className="library__row-label">{patch.name}</span>
                <span className="library__row-desc">{patch.id}</span>
              </button>
              {deleteAction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="library__row-action"
                  onClick={() => {
                    setDeleteTarget({
                      id: patch.id,
                      name: patch.name,
                      version: Number(patch.version),
                    });
                  }}
                >
                  {deleteAction.label}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <DiscardChangesDialog
        open={pendingOpenId !== null}
        onStay={() => setPendingOpenId(null)}
        onDiscard={() => {
          const id = pendingOpenId;
          setPendingOpenId(null);
          if (id) void openPatch(id);
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

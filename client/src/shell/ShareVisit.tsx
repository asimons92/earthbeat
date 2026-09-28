import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { DomainGraph } from '@/persist/graphMapper';
import { shareTokenFromPath } from '@/persist/shareSession';
import { DiscardChangesDialog } from '@/shell/PatchFileDialogs';
import { trpc } from '@/trpc';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

function graphFromView(view: {
  connectors: DomainGraph['connectors'];
  modulators: DomainGraph['modulators'];
  oscillators: DomainGraph['oscillators'];
  effects: DomainGraph['effects'];
  wires: DomainGraph['wires'];
}): DomainGraph {
  return {
    connectors: view.connectors,
    modulators: view.modulators,
    oscillators: view.oscillators,
    effects: view.effects,
    wires: view.wires,
  };
}

export function ShareVisit() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = shareTokenFromPath(location.pathname);
  const {
    draftReady,
    isDirty,
    persistStatus,
    shareVisit,
    shareRouteHold,
    enterSharedPatch,
    failSharedPatch,
    leaveSharedPatch,
    releaseShareRouteHold,
    reportShareMissing,
  } = usePatchWorkspace();
  const utils = trpc.useUtils();
  const [acceptedToken, setAcceptedToken] = useState<string | null>(null);
  const missedTokenRef = useRef<string | null>(null);
  const discardOpen = Boolean(
    token &&
      draftReady &&
      !shareRouteHold &&
      isDirty &&
      acceptedToken !== token &&
      shareVisit?.token !== token,
  );

  useEffect(() => {
    if (!draftReady) return;
    if (shareRouteHold) {
      if (!token) releaseShareRouteHold();
      return;
    }
    if (!token) {
      missedTokenRef.current = null;
      reportShareMissing(false);
      leaveSharedPatch();
      return;
    }
    if (shareVisit?.token === token) {
      missedTokenRef.current = null;
      reportShareMissing(false);
      return;
    }
    if (missedTokenRef.current === token) return;
    if (isDirty && acceptedToken !== token) return;
    if (persistStatus === 'saving') return;

    let cancelled = false;
    void (async () => {
      try {
        const view = await utils.patch.getByShareToken.fetch({ token });
        if (cancelled) return;
        const entered = enterSharedPatch({
          token,
          name: view.name,
          graph: graphFromView(view),
          discardDirty: acceptedToken === token,
        });
        if (!entered) return;
        missedTokenRef.current = null;
        reportShareMissing(false);
      } catch {
        if (cancelled) return;
        failSharedPatch();
        missedTokenRef.current = token;
        reportShareMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    acceptedToken,
    draftReady,
    enterSharedPatch,
    failSharedPatch,
    isDirty,
    leaveSharedPatch,
    persistStatus,
    releaseShareRouteHold,
    reportShareMissing,
    shareRouteHold,
    shareVisit,
    token,
    utils.patch.getByShareToken,
  ]);

  return (
    <DiscardChangesDialog
      open={discardOpen}
      onStay={() => {
        navigate('/');
      }}
      onDiscard={() => {
        if (!token) return;
        setAcceptedToken(token);
      }}
    />
  );
}

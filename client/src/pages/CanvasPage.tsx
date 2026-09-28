import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { NodeInspector } from '@/components/NodeInspector';
import { startGoogleSignIn } from '@/persist/authActions';
import { shellAuthActions, shellPatchFileActions } from '@/generated/catalog';
import { PatchNameDialog } from '@/shell/PatchFileDialogs';
import { useTheme } from '@/theme/useTheme';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';

const SHARE_COPY_PENDING_KEY = 'earthbeat.shareCopyPending';
import { ConnectorNode } from '@/nodes/ConnectorNode';
import { EffectNode } from '@/nodes/EffectNode';
import { ModulatorNode } from '@/nodes/ModulatorNode';
import { OscillatorNode } from '@/nodes/OscillatorNode';

const nodeTypes = {
  connector: ConnectorNode,
  modulator: ModulatorNode,
  effect: EffectNode,
  oscillator: OscillatorNode,
} satisfies NodeTypes;

export function CanvasPage() {
  const { mode: themeMode } = useTheme();
  const {
    nodes,
    edges,
    flowNodes,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onSelectionChange,
    onChangeNodeData,
    removeNode,
    lastSamplesByKind,
    sessionReady,
    graphLocked,
    shareVisit,
    shareMissing,
    saveSharedCopy,
  } = usePatchWorkspace();
  const navigate = useNavigate();
  const [copyAsked, setCopyAsked] = useState(false);
  const [ignoredPending, setIgnoredPending] = useState(false);
  const saveCopyAction = shellPatchFileActions.find((action) => action.key === 'saveCopy');
  const signInAction = shellAuthActions.find((action) => action.key === 'google_sign_in');
  const pendingCopy =
    sessionReady &&
    shareVisit !== null &&
    !ignoredPending &&
    sessionStorage.getItem(SHARE_COPY_PENDING_KEY) === shareVisit.token;
  const copyOpen = copyAsked || pendingCopy;

  const closeCopy = () => {
    sessionStorage.removeItem(SHARE_COPY_PENDING_KEY);
    setCopyAsked(false);
    setIgnoredPending(true);
  };

  const onSaveCopy = () => {
    if (!shareVisit) return;
    if (!sessionReady) {
      sessionStorage.setItem(SHARE_COPY_PENDING_KEY, shareVisit.token);
      void startGoogleSignIn();
      return;
    }
    setCopyAsked(true);
  };

  return (
    <>
      <main className={graphLocked ? 'shell__canvas shell__canvas--locked' : 'shell__canvas'}>
        {shareMissing ? (
          <div className="share-missing">
            <p>This shared Patch is not available.</p>
            <Link to="/patches">Patch Library</Link>
          </div>
        ) : null}
        {shareVisit && saveCopyAction ? (
          <div className="share-banner">
            <p>
              {shareVisit.name} is a shared Patch. Play it, or save a copy.
            </p>
            <Button type="button" size="sm" onClick={onSaveCopy}>
              {saveCopyAction.label}
            </Button>
            {!sessionReady && signInAction ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void startGoogleSignIn();
                }}
              >
                {signInAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          colorMode={themeMode}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={!graphLocked}
          nodesConnectable={!graphLocked}
          elementsSelectable
        >
          <Background
            id="dot-grid"
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1.4}
            color="var(--grid-dot)"
          />
        </ReactFlow>
      </main>
      <NodeInspector
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        lastSamplesByKind={lastSamplesByKind}
        onChangeNodeData={onChangeNodeData}
        onRemoveNode={removeNode}
      />
      <PatchNameDialog
        open={copyOpen}
        title={saveCopyAction?.label ?? ''}
        description="Save this shared Patch as a Patch you own."
        initialName={shareVisit?.name ?? ''}
        onCancel={closeCopy}
        onConfirm={(name) => {
          closeCopy();
          void saveSharedCopy(name).then((created) => {
            if (created) navigate('/');
          });
        }}
      />
    </>
  );
}

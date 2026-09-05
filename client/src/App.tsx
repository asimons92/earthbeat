import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { CanvasPage } from '@/pages/CanvasPage';
import { ConnectorKindDetailPage } from '@/pages/ConnectorKindDetailPage';
import { ConnectorLibraryPage } from '@/pages/ConnectorLibraryPage';
import { EffectKindDetailPage } from '@/pages/EffectKindDetailPage';
import { EffectLibraryPage } from '@/pages/EffectLibraryPage';
import { PatchLibraryPage } from '@/pages/PatchLibraryPage';
import { AppShell } from '@/shell/AppShell';
import { PatchWorkspaceProvider } from '@/workspace/PatchWorkspace';

export default function App() {
  return (
    <BrowserRouter>
      <PatchWorkspaceProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<CanvasPage />} />
            <Route path="connectors" element={<ConnectorLibraryPage />} />
            <Route path="connectors/:kindKey" element={<ConnectorKindDetailPage />} />
            <Route path="effects" element={<EffectLibraryPage />} />
            <Route path="effects/:kindKey" element={<EffectKindDetailPage />} />
            <Route path="patches" element={<PatchLibraryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PatchWorkspaceProvider>
    </BrowserRouter>
  );
}

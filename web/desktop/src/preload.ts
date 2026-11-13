import { contextBridge, ipcRenderer } from 'electron';
import { BRIDGE_CHANNEL, errorResponse, isBridgeRequest, type BridgeEvent, type BridgeResponse } from '@weavtune/shared/bridge';

/**
 * The page's bridge client (web/shared/src/bridge/client.ts) already has a window-message
 * transport for browsers without externally_connectable. This is its other end: requests go to
 * the main process, answers come back as window messages. Nothing else of Electron is exposed.
 */
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== location.origin) return;
  if (!isBridgeRequest(event.data)) return;
  const request = event.data;
  void (ipcRenderer.invoke('weavtune:bridge', request) as Promise<BridgeResponse>)
    .then((response) => window.postMessage(response, location.origin))
    .catch((error: unknown) => window.postMessage(errorResponse(request.id, 'internal', String(error)), location.origin));
});

// Pushes from the main process (a sign-in finished) reach the page as the relay's event messages.
ipcRenderer.on('weavtune:event', (_event, payload: BridgeEvent) => {
  window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'event', payload }, location.origin);
});

contextBridge.exposeInMainWorld('weavtuneDesktop', {
  platform: process.platform,
  version: ipcRenderer.sendSync('weavtune:version') as string,
});


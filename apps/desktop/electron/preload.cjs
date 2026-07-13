const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('hermesDesktop', {
  getConnection: profile => ipcRenderer.invoke('lailaba:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('lailaba:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('lailaba:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('lailaba:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('lailaba:window:openSession', sessionId, opts),
  openNewSessionWindow: () => ipcRenderer.invoke('lailaba:window:openNewSession'),
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('lailaba:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('lailaba:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('lailaba:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('lailaba:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('lailaba:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('lailaba:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('lailaba:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('lailaba:pet-overlay:state', listener)
      return () => ipcRenderer.removeListener('lailaba:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('lailaba:pet-overlay:control', listener)
      return () => ipcRenderer.removeListener('lailaba:pet-overlay:control', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('lailaba:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('lailaba:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('lailaba:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('lailaba:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('lailaba:connection-config:test', payload),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('lailaba:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('lailaba:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('lailaba:connection-config:oauth-logout', remoteUrl),
  profile: {
    get: () => ipcRenderer.invoke('lailaba:profile:get'),
    set: name => ipcRenderer.invoke('lailaba:profile:set', name)
  },
  api: request => ipcRenderer.invoke('lailaba:api', request),
  notify: payload => ipcRenderer.invoke('lailaba:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('lailaba:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('lailaba:readFileDataUrl', filePath),
  readFileText: filePath => ipcRenderer.invoke('lailaba:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('lailaba:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('lailaba:writeClipboard', text),
  saveImageFromUrl: url => ipcRenderer.invoke('lailaba:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('lailaba:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('lailaba:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('lailaba:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('lailaba:watchPreviewFile', url),
  stopPreviewFileWatch: id => ipcRenderer.invoke('lailaba:stopPreviewFileWatch', id),
  setTitleBarTheme: payload => ipcRenderer.send('lailaba:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('lailaba:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('lailaba:translucency', payload),
  setPreviewShortcutActive: active => ipcRenderer.send('lailaba:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('lailaba:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('lailaba:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('lailaba:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('lailaba:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('lailaba:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('lailaba:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('lailaba:setting:defaultProjectDir:pick')
  },
  revealLogs: () => ipcRenderer.invoke('lailaba:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('lailaba:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('lailaba:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('lailaba:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('lailaba:fs:reveal', targetPath),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('lailaba:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('lailaba:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('lailaba:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('lailaba:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('lailaba:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('lailaba:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('lailaba:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('lailaba:git:branchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('lailaba:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('lailaba:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('lailaba:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('lailaba:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('lailaba:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('lailaba:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('lailaba:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('lailaba:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('lailaba:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('lailaba:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('lailaba:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('lailaba:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('lailaba:git:review:shipInfo', repoPath),
      createPr: repoPath => ipcRenderer.invoke('lailaba:git:review:createPr', repoPath)
    }
  },
  terminal: {
    dispose: id => ipcRenderer.invoke('lailaba:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('lailaba:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('lailaba:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('lailaba:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `lailaba:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `lailaba:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('lailaba:close-preview-requested', listener)
    return () => ipcRenderer.removeListener('lailaba:close-preview-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('lailaba:open-updates', listener)
    return () => ipcRenderer.removeListener('lailaba:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:deep-link', listener)
    return () => ipcRenderer.removeListener('lailaba:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('lailaba:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:window-state-changed', listener)
    return () => ipcRenderer.removeListener('lailaba:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('lailaba:focus-session', listener)
    return () => ipcRenderer.removeListener('lailaba:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:notification-action', listener)
    return () => ipcRenderer.removeListener('lailaba:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:preview-file-changed', listener)
    return () => ipcRenderer.removeListener('lailaba:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:backend-exit', listener)
    return () => ipcRenderer.removeListener('lailaba:backend-exit', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('lailaba:power-resume', listener)
    return () => ipcRenderer.removeListener('lailaba:power-resume', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:boot-progress', listener)
    return () => ipcRenderer.removeListener('lailaba:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.cjs (apps/desktop/electron/bootstrap-runner.cjs).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('lailaba:bootstrap:get'),
  resetBootstrap: () => ipcRenderer.invoke('lailaba:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('lailaba:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('lailaba:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('lailaba:bootstrap:event', listener)
    return () => ipcRenderer.removeListener('lailaba:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('lailaba:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('lailaba:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('lailaba:uninstall:summary'),
    run: mode => ipcRenderer.invoke('lailaba:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('lailaba:updates:check'),
    apply: opts => ipcRenderer.invoke('lailaba:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('lailaba:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('lailaba:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('lailaba:updates:progress', listener)
      return () => ipcRenderer.removeListener('lailaba:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('lailaba:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('lailaba:vscode-theme:search', query)
  }
})

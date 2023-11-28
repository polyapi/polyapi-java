import vscode from 'vscode';
import fs, { Stats } from 'fs';

import { polySpecsChanged } from './events';
import { getCredentialsFromExtension, isPolyLibraryInstalled, saveCredentialsInExtension, saveLibraryConfig } from './common';
import { saveLastOpenedFileName } from './chat/language';
import { getContextData } from '@poly/common/specs';

const CHECK_INTERVAL = 5000;

let libraryInstalledCheckerTimeoutID: NodeJS.Timeout;
let prevPolyLibraryInstalledState = false;

type Info = {
  timeoutID: NodeJS.Timeout;
  credentialsFileStats?: Stats;
  polyFolderStats?: Stats;
};

const watchedWorkspaceInfos = new Map<vscode.WorkspaceFolder, Info>();
const watchedFileInfos = new Map<string, Stats>();

const checkForLibraryInstalled = () => {
  const installed = isPolyLibraryInstalled();

  if (installed && !prevPolyLibraryInstalledState) {
    const extensionCredentials = getCredentialsFromExtension();
    if (extensionCredentials.apiBaseUrl && extensionCredentials.apiKey) {
      saveLibraryConfig({
        POLY_API_BASE_URL: extensionCredentials.apiBaseUrl,
        POLY_API_KEY: extensionCredentials.apiKey,
      });
    } else {
      vscode.commands.executeCommand('setContext', 'missingCredentials', false);
    }
  }

  prevPolyLibraryInstalledState = installed;

  libraryInstalledCheckerTimeoutID = setTimeout(() => checkForLibraryInstalled(), CHECK_INTERVAL);
  vscode.commands.executeCommand('setContext', 'polyLibraryInstalled', installed);
};

const updateMissingCredentialsContext = (credentials: ReturnType<typeof getCredentialsFromExtension>) => {
  if (!credentials.apiBaseUrl || !credentials.apiKey) {
    vscode.commands.executeCommand('setContext', 'missingCredentials', true);
  } else {
    vscode.commands.executeCommand('setContext', 'missingCredentials', false);
  }
};

const watchCredentials = () => {
  return vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('poly.apiBaseUrl') || event.affectsConfiguration('poly.apiKey')) {
      const credentials = getCredentialsFromExtension();

      updateMissingCredentialsContext(credentials);

      if (isPolyLibraryInstalled()) {
        saveLibraryConfig({
          POLY_API_BASE_URL: credentials.apiBaseUrl,
          POLY_API_KEY: credentials.apiKey,
        });
      }
    }
  });
};

const trackLastOpenedFile = (context: vscode.ExtensionContext) => {
  const activeTextEditor = vscode.window.activeTextEditor;

  if (activeTextEditor) {
    saveLastOpenedFileName(context, activeTextEditor.document.fileName);
  }

  return vscode.window.onDidChangeActiveTextEditor((event) => {
    if (typeof event !== 'undefined') {
      saveLastOpenedFileName(context, event.document.fileName);
    }
  });
};

export const start = (context: vscode.ExtensionContext) => {
  polySpecsChanged({});

  const onDidChangeWorkspaceFoldersDisposable = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    event.added.forEach(watchWorkspace);
    event.removed.forEach(unwatchWorkspace);
  });
  vscode.workspace.workspaceFolders?.forEach(watchWorkspace);

  const trackOpenedFileDisposable = trackLastOpenedFile(context);

  checkForLibraryInstalled();

  updateMissingCredentialsContext(getCredentialsFromExtension());

  const credentialsWatcherDisposable = watchCredentials();

  return () => {
    watchedWorkspaceInfos.forEach((_, folder) => unwatchWorkspace(folder));
    if (libraryInstalledCheckerTimeoutID) {
      clearTimeout(libraryInstalledCheckerTimeoutID);
    }
    prevPolyLibraryInstalledState = false;
    credentialsWatcherDisposable.dispose();
    onDidChangeWorkspaceFoldersDisposable.dispose();
    trackOpenedFileDisposable.dispose();
  };
};

const getPolySpecsPath = (folder: vscode.WorkspaceFolder) => `${folder.uri.fsPath}/node_modules/.poly/lib/specs.json`;
const getPolySpecs = (folder: vscode.WorkspaceFolder) => {
  const polyDataPath = getPolySpecsPath(folder);
  if (!fs.existsSync(polyDataPath)) {
    return {};
  }
  return getContextData(JSON.parse(fs.readFileSync(polyDataPath, 'utf8')));
};

const getLibraryCredentialsPathFromWorkspace = (folder: vscode.WorkspaceFolder) => `${folder.uri.fsPath}/node_modules/.poly/.config.env`;
const getLibraryCredentialsFromWorkspace = (folder: vscode.WorkspaceFolder) => {
  const libCredentialsPath = getLibraryCredentialsPathFromWorkspace(folder);
  if (!fs.existsSync(libCredentialsPath)) {
    return {};
  }

  const content = fs.readFileSync(libCredentialsPath, 'utf8');

  const credentialsList = content.split('\n').filter(line => ['POLY_API_BASE_URL', 'POLY_API_KEY'].includes(line.split('=')[0]));

  return credentialsList.reduce((acum, value) => {
    const [credentialKey, credentialValue] = value.split('=');

    return {
      ...acum,
      [credentialKey === 'POLY_API_BASE_URL' ? 'apiBaseUrl' : 'apiKey']: credentialValue,
    };
  }, {});
};

const watchWorkspace = (folder: vscode.WorkspaceFolder) => {
  const polyDataPath = getPolySpecsPath(folder);
  let credentialsFileStats: Stats | undefined;
  let polyFolderStats: Stats | undefined;

  if (fs.existsSync(polyDataPath)) {
    polyFolderStats = fs.statSync(polyDataPath);

    if (watchedFileInfos.get(polyDataPath)?.mtimeMs !== polyFolderStats.mtimeMs) {
      console.log('POLY: Poly library changed, sending event...');
      watchedFileInfos.set(polyDataPath, polyFolderStats);
      polySpecsChanged(getPolySpecs(folder));
    }
  } else if (watchedWorkspaceInfos.get(folder)?.polyFolderStats) {
    console.log('POLY: Poly library changed, sending event...');
    polySpecsChanged({});
  }

  const credentialsFilePath = getLibraryCredentialsPathFromWorkspace(folder);

  if (fs.existsSync(credentialsFilePath)) {
    credentialsFileStats = fs.statSync(credentialsFilePath);

    if (!watchedFileInfos.get(credentialsFilePath)) {
      watchedFileInfos.set(credentialsFilePath, credentialsFileStats);
    } else if (watchedFileInfos.get(credentialsFilePath)?.mtimeMs !== credentialsFileStats.mtimeMs) {
      console.log('POLY: Poly library credentials changed, synchronizing...');
      watchedFileInfos.set(credentialsFilePath, credentialsFileStats);
      const credentials = getLibraryCredentialsFromWorkspace(folder) as any;
      saveCredentialsInExtension(credentials.apiBaseUrl, credentials.apiKey);
    }
  }

  const timeoutID = setTimeout(() => watchWorkspace(folder), CHECK_INTERVAL);
  watchedWorkspaceInfos.set(folder, { timeoutID, credentialsFileStats, polyFolderStats });
};

const unwatchWorkspace = (folder: vscode.WorkspaceFolder) => {
  const info = watchedWorkspaceInfos.get(folder);
  if (info) {
    if (info.timeoutID) {
      clearTimeout(info.timeoutID);
    }
    watchedWorkspaceInfos.delete(folder);
  }
};

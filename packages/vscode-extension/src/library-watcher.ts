import vscode from 'vscode';
import fs, { Stats } from 'fs';

import { polySpecsChanged } from './events';
import { getCredentialsFromExtension, saveCredentialsOnClientLibrary } from './common';

const CHECK_INTERVAL = 5000;

let libraryInstalledCheckerTimeoutID: NodeJS.Timeout;

type Info = {
  timeoutID: NodeJS.Timeout;
  fileStats?: Stats;
};

const watchedWorkspaceInfos = new Map<vscode.WorkspaceFolder, Info>();

const checkForLibraryInstalled = () => {
  let installed = false;
  vscode.workspace.workspaceFolders?.forEach((folder) => {
    if (fs.existsSync(`${folder.uri.fsPath}/node_modules/polyapi/package.json`)) {
      installed = true;
    } else {
      installed = false;
    }
  });
  libraryInstalledCheckerTimeoutID = setTimeout(() => checkForLibraryInstalled(), CHECK_INTERVAL);
  vscode.commands.executeCommand('setContext', 'polyLibraryInstalled', installed);
};

function checkCredentials() {
  const initCredentials = getCredentialsFromExtension();
  if (initCredentials.apiBaseUrl && initCredentials.apiKey) {
    saveCredentialsOnClientLibrary(initCredentials.apiBaseUrl, initCredentials.apiKey);
  } else {
    vscode.commands.executeCommand('setContext', 'missingCredentials', false);
  }

  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('poly.apiBaseUrl') || event.affectsConfiguration('poly.apiKey')) {
      const credentials = getCredentialsFromExtension();
      if (!credentials.apiBaseUrl || !credentials.apiKey) {
        vscode.commands.executeCommand('setContext', 'missingCredentials', true);
      } else {
        saveCredentialsOnClientLibrary(credentials.apiBaseUrl, credentials.apiKey);
        vscode.commands.executeCommand('setContext', 'missingCredentials', false);
      }
    }
  });
}

export const start = () => {
  polySpecsChanged({});

  vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    event.added.forEach(watchWorkspace);
    event.removed.forEach(unwatchWorkspace);
  });
  vscode.workspace.workspaceFolders?.forEach(watchWorkspace);

  checkForLibraryInstalled();

  checkCredentials();

  return () => {
    watchedWorkspaceInfos.forEach((_, folder) => unwatchWorkspace(folder));
    if (libraryInstalledCheckerTimeoutID) {
      clearTimeout(libraryInstalledCheckerTimeoutID);
    }
  };
};

const getPolySpecsPath = (folder: vscode.WorkspaceFolder) => `${folder.uri.fsPath}/node_modules/.poly/lib/specs.json`;
const getPolySpecs = (folder: vscode.WorkspaceFolder) => {
  const polyDataPath = getPolySpecsPath(folder);
  if (!fs.existsSync(polyDataPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(polyDataPath, 'utf8'));
};

const watchWorkspace = (folder: vscode.WorkspaceFolder) => {
  const polyDataPath = getPolySpecsPath(folder);
  let stats: Stats;

  if (fs.existsSync(polyDataPath)) {
    stats = fs.statSync(polyDataPath);
    if (watchedWorkspaceInfos.get(folder)?.fileStats?.mtimeMs !== stats.mtimeMs) {
      console.log('POLY: Poly library changed, sending event...');
      watchedWorkspaceInfos.set(folder, { timeoutID: null, fileStats: stats });
      polySpecsChanged(getPolySpecs(folder));
    }
  } else if (watchedWorkspaceInfos.get(folder)?.fileStats) {
    console.log('POLY: Poly library changed, sending event...');
    polySpecsChanged({});
  }

  const timeoutID = setTimeout(() => watchWorkspace(folder), CHECK_INTERVAL);
  watchedWorkspaceInfos.set(folder, { timeoutID, fileStats: stats });
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

import vscode from 'vscode';
import fs, { Stats } from 'fs';

import { polySpecsChanged } from './events';
import { getCredentialsFromExtension, isPolyLibraryInstalled, saveCredentialsInExtension, saveCredentialsOnClientLibrary } from './common';

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
    const initCredentials = getCredentialsFromExtension();
    if (initCredentials.apiBaseUrl && initCredentials.apiKey) {
      saveCredentialsOnClientLibrary(initCredentials.apiBaseUrl, initCredentials.apiKey);
    } else {
      vscode.commands.executeCommand('setContext', 'missingCredentials', false);
    }
  }

  prevPolyLibraryInstalledState = installed;

  libraryInstalledCheckerTimeoutID = setTimeout(() => checkForLibraryInstalled(), CHECK_INTERVAL);
  vscode.commands.executeCommand('setContext', 'polyLibraryInstalled', installed);
};

const watchCredentials = () => {
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
};

export const start = () => {
  polySpecsChanged({});

  vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    event.added.forEach(watchWorkspace);
    event.removed.forEach(unwatchWorkspace);
  });
  vscode.workspace.workspaceFolders?.forEach(watchWorkspace);

  checkForLibraryInstalled();

  watchCredentials();

  return () => {
    watchedWorkspaceInfos.forEach((_, folder) => unwatchWorkspace(folder));
    if (libraryInstalledCheckerTimeoutID) {
      clearTimeout(libraryInstalledCheckerTimeoutID);
    }
    prevPolyLibraryInstalledState = false;
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

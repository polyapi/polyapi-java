import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';

export const HOST_LIBRARY_VERSION_MAP = {
  'na1.polyapi.io': 'latest',
  'develop-k8s.polyapi.io': 'develop',
};

export const getCredentialsFromExtension = () => {
  return {
    apiBaseUrl: vscode.workspace.getConfiguration('poly').get('apiBaseUrl'),
    apiKey: vscode.workspace.getConfiguration('poly').get('apiKey'),
  };
};

export const saveCredentialsInExtension = (apiBaseUrl: unknown, apiKey: unknown) => {
  vscode.workspace.getConfiguration('poly').update('apiBaseUrl', apiBaseUrl);
  vscode.workspace.getConfiguration('poly').update('apiKey', apiKey);
};

export const getWorkspacePath = () => {
  return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
};

export const getPackageManager = (): 'yarn' | 'npm' => {
  return fs.existsSync(`${getWorkspacePath()}/yarn.lock`) ? 'yarn' : 'npm';
};

export const getLibraryVersionFromApiHost = (apiBaseUrl: unknown) => {
  let result = '';

  if (!apiBaseUrl) {
    return result;
  }

  for (const [k, v] of Object.entries(HOST_LIBRARY_VERSION_MAP)) {
    if ((apiBaseUrl as string).match(new RegExp(k))) {
      result = v;
      break;
    }
  }

  return result;
};

export const saveCredentialsOnClientLibrary = (apiBaseUrl: unknown, apiKey: unknown) => {
  const workspacePath = getWorkspacePath();

  if (!workspacePath) {
    return;
  }

  const polyFolder = path.join(getWorkspacePath(), 'node_modules/.poly');

  try {
    fs.mkdirSync(polyFolder, { recursive: true });
    fs.writeFileSync(
      path.join(polyFolder, '.config.env'),
          `POLY_API_BASE_URL=${apiBaseUrl}\nPOLY_API_KEY=${apiKey}\n`,
    );
  } catch (err) {
    console.log(err);
  }
};

export const isPolyLibraryInstalled = () => {
  return vscode.workspace.workspaceFolders?.some((folder) => {
    if (fs.existsSync(`${folder.uri.fsPath}/node_modules/polyapi/package.json`)) {
      return true;
    }

    return false;
  });
};

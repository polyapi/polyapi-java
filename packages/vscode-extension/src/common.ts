import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';

export const HOST_LIBRARY_VERSION_MAP = {
  'na1.polyapi.io': 'latest',
  'develop-k8s.polyapi.io': 'develop',
  'staging.polyapi.io': 'staging',
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
  return vscode.workspace.workspaceFolders[0].uri.fsPath;
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
  const polyFolder = path.join(getWorkspacePath(), 'node_modules/.poly');

  fs.mkdirSync(polyFolder, { recursive: true });
  fs.writeFileSync(
    path.join(polyFolder, '.config.env'),
        `POLY_API_BASE_URL=${apiBaseUrl}\nPOLY_API_KEY=${apiKey}\n`,
  );
};

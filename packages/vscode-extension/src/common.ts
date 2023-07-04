import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';

export const HOST_LIBRARY_VERSION_MAP = {
    'na1.polyapi.io': 'latest',
    'develop-k8s.polyapi.io': 'develop',
    'staging.polyapi.io': 'staging',
};

export function getCredentials() {
    return {
        apiBaseUrl: vscode.workspace.getConfiguration('poly').get('apiBaseUrl'),
        apiKey: vscode.workspace.getConfiguration('poly').get('apiKey'),
    };
}

export function getWorkspacePath() {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

export function getPackageManager(): 'yarn' | 'npm' {
    return fs.existsSync(`${getWorkspacePath()}/yarn.lock`) ? 'yarn' : 'npm';
}

export function getLibraryVersionFromApiHost(apiBaseUrl: unknown) {
    let result = ''

    if(!apiBaseUrl) {
        return result;
    }

    for(const [k, v] of Object.entries(HOST_LIBRARY_VERSION_MAP)) {
        if((apiBaseUrl as string).match(new RegExp(k))) {
            result = v;
            break;
        }
    }

    return result;

}

export function saveConfigOnClientLibrary(config: Record<string, string>) {

    const polyFolder = path.join(getWorkspacePath(), 'node_modules/.poly');

    fs.mkdirSync(polyFolder, { recursive: true });
    fs.writeFileSync(
      path.join(polyFolder, '.config.env'),
      Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    );
  };

// node_modules/.poly/.config.env
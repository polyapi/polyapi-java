import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { getCredentials, getLibraryVersionFromApiHost, getPackageManager, getWorkspacePath, saveConfigOnClientLibrary } from './common';

const exec = promisify(childProcess.exec);

const URL_REGEX = /https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))/;

export default class DefaultViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
    const credentials = getCredentials();
    if (!credentials.apiBaseUrl || !credentials.apiKey) {
      vscode.commands.executeCommand('setContext', 'missingCredentials', true);
    }
  }

  public async setupLibraryCredentials() {
    const credentials = getCredentials();

    if (credentials.apiBaseUrl && credentials.apiKey) {
      return saveConfigOnClientLibrary(credentials as Record<string, string>);
    }

    const apiBaseUrl = await vscode.window.showInputBox({
      title: 'Credentials',
      prompt: 'Set your api base url.',
      validateInput(value) {
        if (!URL_REGEX.test(value)) {
          return {
            message: 'Given URL is not valid. Please enter valid URL.',
            severity: vscode.InputBoxValidationSeverity.Error,
          };
        }
        return null;
      },
      value: (credentials.apiBaseUrl as string) || 'https://na1.polyapi.io'
    });

    const apiKey = await vscode.window.showInputBox({
      title: 'Credentials',
      prompt: 'Set your api key.',
      validateInput(value) {
        if (!value.trim().length) {
          return {
            message: 'You must provide an api key.',
            severity: vscode.InputBoxValidationSeverity.Error,
          };
        }
        return null;
      },
      value: (credentials.apiKey as string)
    });

    if (apiBaseUrl && apiKey) {
      vscode.workspace.getConfiguration('poly').update('apiBaseUrl', apiBaseUrl);
      vscode.workspace.getConfiguration('poly').update('apiKey', apiKey);
      saveConfigOnClientLibrary({ apiBaseUrl: apiBaseUrl.trim(), apiKey: apiKey.trim() } as Record<string, string>);
      vscode.commands.executeCommand('setContext', 'missingCredentials', false);
    }
  }

  private installLibrary() {
    return new Promise((resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing poly library',
        cancellable: false,
      }, async () => {
        vscode.commands.executeCommand('setContext', 'installingPolyLibrary', true);
        const packageManager = getPackageManager();
        const credentials = getCredentials();

        const libraryVersion = getLibraryVersionFromApiHost(credentials.apiBaseUrl);
        const libraryFullName = `polyapi${libraryVersion ? `@${libraryVersion}` : ''}`;

        let installCommand = `npm install ${libraryFullName}`;

        if (packageManager === 'yarn') {
          installCommand = `yarn add ${libraryFullName}`;
        }

        try {
          const workSpacePath = getWorkspacePath();
          if (!workSpacePath) {
            throw new Error('Path not found');
          }

          const result = await exec(`cd ${workSpacePath} && ${installCommand}`);

          if (result.stderr) {
            throw new Error('Failed to install polyapi.');
          }

          vscode.window.showInformationMessage('Poly library installed.');
        } catch (err) {
          reject(err);
        }
        vscode.commands.executeCommand('setContext', 'installingPolyLibrary', false);
      });
    });
  }

  async setupLibrary() {
    try {
      await this.setupLibraryCredentials();
    } catch (err) {
      vscode.window.showErrorMessage('Failed to set poly credentials.');
    }

    try {
      await this.installLibrary();
    } catch (err) {
      vscode.window.showErrorMessage('Failed to install polyapi.');
    }
  }
}

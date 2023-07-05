import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { getCredentials, getLibraryVersionFromApiHost, getPackageManager, getWorkspacePath, saveCredentialsOnClientLibrary } from './common';

const exec = promisify(childProcess.exec);

const URL_REGEX = /https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))/;

export default class DefaultViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
    this.init();
  }

  async setupLibraryCredentials() {
    const credentials = getCredentials();

    if (credentials.apiBaseUrl && credentials.apiKey) {
      return saveCredentialsOnClientLibrary(credentials.apiBaseUrl, credentials.apiKey);
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
      saveCredentialsOnClientLibrary(apiBaseUrl, apiKey);
      vscode.commands.executeCommand('setContext', 'missingCredentials', false);
    } else {
      throw new Error('Missing credentials.');
    }
  }

  async setupLibrary() {
    try {
      await this.setupLibraryCredentials();
    } catch (err) {
      return vscode.window.showErrorMessage('Failed to set poly credentials.');
    }

    try {
      await this.installLibrary();
      vscode.window.showInformationMessage('Poly library installed.');
    } catch (err) {
      return vscode.window.showErrorMessage('Failed to install polyapi');
    }

    try {
      await this.execGenerateCommandInLibrary();
      vscode.window.showInformationMessage('Generated poly client code.');
    } catch (err) {
      vscode.window.showErrorMessage('Failed to generate poly client code.');
    }
  }
  
  private setMissingCredentialsFlagIfNeeded() {
    const credentials = getCredentials();
    if (!credentials.apiBaseUrl || !credentials.apiKey) {
      vscode.commands.executeCommand('setContext', 'missingCredentials', true);
    }
  }

  private setupEvents() {
    vscode.workspace.onDidChangeConfiguration(event => {
      if(event.affectsConfiguration('poly.apiBaseUrl') || event.affectsConfiguration('poly.apiKey')) {
        const apiBaseUrl = vscode.workspace.getConfiguration('poly').get('apiBaseUrl');
        const apiKey = vscode.workspace.getConfiguration('poly').get('apiKey');

        if(!apiBaseUrl || !apiKey) {
          vscode.commands.executeCommand('setContext', 'missingCredentials', true);
        } else {
          vscode.commands.executeCommand('setContext', 'missingCredentials', false);
        }
      }
    });
  }

  private init() {
    this.setMissingCredentialsFlagIfNeeded();
    this.setupEvents();
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

          await exec(`cd ${workSpacePath} && ${installCommand}`);

          resolve(true);
        } catch (err) {
          reject(err);
        }
        vscode.commands.executeCommand('setContext', 'installingPolyLibrary', false);
      });
    });
  }

  private execGenerateCommandInLibrary() {
    return new Promise((resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating poly functions.',
        cancellable: false,
      }, async () => {
        try {
          const workSpacePath = getWorkspacePath();
          if (!workSpacePath) {
            throw new Error('Path not found');
          }

          await exec(`cd ${workSpacePath} && npx poly generate`);

          resolve(true);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

}

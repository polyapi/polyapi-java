import * as vscode from 'vscode';
import ChatViewProvider from './chat-view-provider';
import LibraryIndexViewProvider from './library-index-view-provider';

import { start as startLibraryWatcher } from './library-watcher';
import { registerPolySpecsChangedListener } from './events';

export async function activate(context: vscode.ExtensionContext) {
  const chatViewProvider = new ChatViewProvider(context);
  const libraryIndexViewProvider = new LibraryIndexViewProvider();

  const unregisterPolyFunctionsRegeneratedListener = registerPolySpecsChangedListener(contexData => {
    console.log('POLY: Restarting TS server...');
    vscode.commands.executeCommand('typescript.restartTsServer');

    console.log('POLY: Regenerating index tree data...');
    libraryIndexViewProvider.refresh(contexData);
  });

  const stopFileWatcher = startLibraryWatcher();

  context.subscriptions.push(
    vscode.commands.registerCommand('poly.focusMessageInput', () => {
      chatViewProvider.focusMessageInput();
    }),
    vscode.commands.registerCommand('poly.copyLibraryItem', LibraryIndexViewProvider.copyLibraryItem),
    vscode.window.registerWebviewViewProvider(
      'poly.ai-view',
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
    vscode.window.registerTreeDataProvider(
      'poly.library-index-view',
      libraryIndexViewProvider,
    ),
    {
      dispose: unregisterPolyFunctionsRegeneratedListener,
    },
    {
      dispose: stopFileWatcher,
    },
  );
}

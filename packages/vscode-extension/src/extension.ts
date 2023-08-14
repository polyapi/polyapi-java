import * as vscode from 'vscode';
import ChatViewProvider from './chat-view-provider';
import LibraryIndexViewProvider from './library-index-view-provider';
import { LibraryTreeItemFileDecorationProvider } from './library-tree-item-file-decoration-provider';

import { start as startLibraryWatcher } from './library-watcher';
import { registerPolySpecsChangedListener } from './events';
import DefaultView from './default-view';

export const activate = (context: vscode.ExtensionContext) => {
  const chatViewProvider = new ChatViewProvider(context);
  const libraryIndexViewProvider = new LibraryIndexViewProvider(context);
  const defaultView = new DefaultView();

  const unregisterPolyFunctionsRegeneratedListener = registerPolySpecsChangedListener(contexData => {
    console.log('POLY: Restarting TS server...');
    vscode.commands.executeCommand('typescript.restartTsServer');

    console.log('POLY: Regenerating index tree data...');
    libraryIndexViewProvider.refresh(contexData);
  });

  const stopFileWatcher = startLibraryWatcher();

  libraryIndexViewProvider.register();

  context.subscriptions.push(
    vscode.commands.registerCommand('poly.focusMessageInput', () => {
      chatViewProvider.focusMessageInput();
    }),
    vscode.commands.registerCommand('poly.copyLibraryItem', LibraryIndexViewProvider.copyLibraryItem),
    vscode.commands.registerCommand('poly.setupLibrary', () => defaultView.setupLibrary()),
    vscode.commands.registerCommand('poly.setupCredentials', () => defaultView.setupLibraryCredentials()),
    vscode.window.registerWebviewViewProvider(
      'poly.ai-view',
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
    {
      dispose: unregisterPolyFunctionsRegeneratedListener,
    },
    {
      dispose: stopFileWatcher,
    },
    vscode.window.registerFileDecorationProvider(new LibraryTreeItemFileDecorationProvider()),
  );
};

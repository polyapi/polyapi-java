import { ExtensionContext } from 'vscode';
import { getWorkspacePath } from '../common';

export type AssistantState = {
    lastOpenedFile?: Record<string, string>;
} | undefined;

export const STATE_KEY = 'assistant';
export const SUPPORTED_FORMAT_LANGUAGE_MAP = {
  tsx: 'Typescript',
  ts: 'Typescript',
  java: 'Java',
};

export const saveLastOpenedFileName = (context: ExtensionContext, filePath: string) => {
  const fileName = filePath.split('/').pop() as string;
  const fileFormat = fileName.split('.').pop() as string;

  const language = SUPPORTED_FORMAT_LANGUAGE_MAP[fileFormat];

  const workspacePath = getWorkspacePath();

  if (typeof language !== 'undefined') {
    const prevAssistantState = context.globalState.get<AssistantState>(STATE_KEY);

    context.globalState.update(STATE_KEY, {
      ...prevAssistantState,
      lastOpenedFile: {
        ...prevAssistantState?.lastOpenedFile,
        [workspacePath]: filePath.split(workspacePath).pop(),
      },
    });
  }
};

export const getLastOpenedFileName = (context: ExtensionContext): string | undefined => {
  const state = context.globalState.get<AssistantState>(STATE_KEY);

  if (typeof state === 'undefined' || typeof state.lastOpenedFile === 'undefined') {
    return undefined;
  }

  return state.lastOpenedFile[getWorkspacePath()];
};

export const getLastOpenedLanguage = (context: ExtensionContext): string | undefined => {
  const fileName = getLastOpenedFileName(context);

  if (typeof fileName === 'undefined') {
    return fileName;
  }

  const format = fileName.split('.').pop();

  if (typeof format === 'undefined') {
    return undefined;
  }

  return SUPPORTED_FORMAT_LANGUAGE_MAP[format];
};

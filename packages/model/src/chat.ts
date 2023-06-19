export type ChatText = {
  type: TextType;
  value: string;
  stats?: any;
};

type TextType = 'plain' | 'js' | 'markdown';

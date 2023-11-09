export type Variables = Record<string, string>;

export type PostmanVariableEntry = {
  key: string;
  value: string;
  disabled?: boolean;
};

export type Header = PostmanVariableEntry;

export type GraphQLBody = {
  mode: 'graphql',
  graphql: {
    query: string;
    variables: string;
  }
}

export type RawBody = {
  mode: 'raw';
  raw: string;
  options?: {
    raw?: {
      language: 'json' | 'javascript' | 'text' | 'xml' | 'html';
    }
  }
};

export type UrlencodedBody = {
  mode: 'urlencoded';
  urlencoded: PostmanVariableEntry[];
};

export type FormDataEntry = PostmanVariableEntry & { type: string };

export type FormDataBody = {
  mode: 'formdata';
  formdata: FormDataEntry[];
};

export type EmptyBody = {
  mode?: 'empty';
};

export type Body = RawBody | UrlencodedBody | FormDataBody | EmptyBody | GraphQLBody;

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type ArgumentType = string;

export type ArgumentsMetadata = {
  [key: string]: {
    name?: string;
    description?: string;
    required?: boolean;
    secure?: boolean;
    type?: ArgumentType;
    typeSchema?: Record<string, any>;
    typeObject?: object;
    payload?: boolean;
    variable?: string | null;
    removeIfNotPresentOnExecute?: boolean;
  };
};

export type FunctionLog = {
  timestamp: Date;
  value: string;
  level: string;
};

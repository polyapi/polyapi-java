export type Variables = Record<string, string>;

export type PostmanVariableEntry = {
  key: string;
  value: string;
  disabled?: boolean;
};

export type Header = PostmanVariableEntry;

export type PostmanGraphQLBody = {
  mode: 'graphql',
  graphql: {
    query: string;
    variables: string;
  }
}

export type RawPostmanBody = {
  mode: 'raw';
  raw: string;
  options?: {
    raw?: {
      language: 'json' | 'javascript' | 'text' | 'xml' | 'html';
    }
  }
};

export type PostmanUrlencodedBody = {
  mode: 'urlencoded';
  urlencoded: PostmanVariableEntry[];
};

export type PostmanFormDataBody = {
  mode: 'formdata';
  formdata: (PostmanVariableEntry & { type: string })[];
};

export type PostmanEmptyBody = {
  mode: 'empty';
};

export type PostmanBody = RawPostmanBody | PostmanUrlencodedBody | PostmanFormDataBody | PostmanEmptyBody | PostmanGraphQLBody;


export type UrlEncodedBody = PostmanUrlencodedBody & { urlencoded: (Omit<PostmanVariableEntry, 'disabled'>)[]};
export type FormDataBody = PostmanFormDataBody & { urlencoded: (Omit<PostmanFormDataBody, 'disabled'>)[]};

export type ApiFunctionBody = RawPostmanBody | UrlEncodedBody | FormDataBody | PostmanEmptyBody | PostmanGraphQLBody;


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
  };
};

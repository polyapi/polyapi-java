export type Variables = Record<string, string>;

export type PostmanVariableEntry = {
  key: string;
  value: string;
  disabled?: boolean;
};

export type Header = PostmanVariableEntry;

export type RawBody = {
  mode: 'raw';
  raw: string;
};

export type UrlencodedBody = {
  mode: 'urlencoded';
  urlencoded: PostmanVariableEntry[];
};

export type FormDataBody = {
  mode: 'formdata';
  formdata: PostmanVariableEntry[];
};

export type EmptyBody = {
  mode: 'empty';
};

export type Body = RawBody | UrlencodedBody | FormDataBody | EmptyBody;
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type ArgumentType = string;

export type ArgumentsMetadata = {
  [key: string]: {
    name?: string;
    required?: boolean;
    secure?: boolean;
    type?: ArgumentType;
    typeSchema?: Record<string, any>;
    typeObject?: object;
    payload?: boolean;
  };
};

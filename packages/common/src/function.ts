export type Header = Record<string, string>;
export type Variables = Record<string, string>;
export type RawBody = {
  mode: 'raw';
  raw: string;
};

export type GraphQLBody = {
  mode: 'graphql';
  graphql: {
    query: string;
    variables?: string;
  }
};

export type UrlencodedBody = {
  mode: 'urlencoded';
  urlencoded: {
    key: string;
    value: string;
    disabled?: boolean;
  }[];
};

export type FormDataBody = {
  mode: 'formdata';
  formdata: {
    key: string;
    value: string;
    disabled?: boolean;
  }[];
};

export type EmptyBody = {
  mode: 'empty';
};

export type Body = RawBody | UrlencodedBody | FormDataBody | EmptyBody | GraphQLBody;
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

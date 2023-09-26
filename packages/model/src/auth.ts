export type Auth = BasicAuth | BearerAuth | ApiKeyAuth | NoAuth;

export class BasicAuth {
  type: 'basic';
  basic: [
    {
      key: 'username';
      value: string;
    },
    {
      key: 'password';
      value: string;
    }
  ];
}

export class BearerAuth {
  type: 'bearer';
  bearer: [
    {
      key: 'token';
      value: string;
    }
  ];
}

export class ApiKeyAuth {
  type: 'apikey';
  apikey: [
    {
      key: 'in';
      value: 'header' | 'query';
    },
    {
      key: 'key';
      value: string;
    },
    {
      key: 'value';
      value: string;
    }
  ];
}

export class NoAuth {
  type: 'noauth';
  noauth: [];
}

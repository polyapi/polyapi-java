/* eslint-disable */
import { FunctionService } from 'function/function.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiFunctionArguments } from 'function/types';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { ApiFunction, Environment, Tenant, Variable } from '@prisma/client';
import { CommonService } from 'common/common.service';
import {
  aiServiceMock,
  commonServiceMock,
  configServiceMock,
  eventServiceMock,
  httpServiceMock,
  prismaServiceMock,
  specsServiceMock,
  variableServiceMock,
  configVariableServiceMock, authServiceMock,
} from '../mocks';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigService } from 'config/config.service';
import { SpecsService } from 'specs/specs.service';
import { EventService } from 'event/event.service';
import { AiService } from 'ai/ai.service';
import { VariableService } from 'variable/variable.service';
import { Visibility } from '@poly/model';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import { AuthService } from 'auth/auth.service';

describe('FunctionService', () => {
  let functionService: FunctionService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        FunctionService,
        {
          provide: CommonService,
          useValue: commonServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
        {
          provide: SpecsService,
          useValue: specsServiceMock,
        },
        {
          provide: EventService,
          useValue: eventServiceMock,
        },
        {
          provide: AiService,
          useValue: aiServiceMock,
        },
        {
          provide: VariableService,
          useValue: variableServiceMock,
        },
        {
          provide: ConfigVariableService,
          useValue: configVariableServiceMock,
        },
        {
          provide: AuthService,
          useValue: authServiceMock,
        }
      ],
    }).compile();

    functionService = moduleRef.get<FunctionService>(FunctionService);
  });

  describe('getFunctionArguments', () => {
    it('should get single function argument from URL', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(1);
      expect(functionArguments[0]).toMatchObject({
        key: 'variable1',
        name: 'variable1',
        type: 'string',
        location: 'url',
      });
    });

    it('should get multiple function arguments from URL', () => {
      const apiFunction: ApiFunctionArguments = {
        url: '{{host}}/{{path}}/{{variable1}}',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(3);
      expect(functionArguments[0]).toMatchObject({
        key: 'host',
        name: 'host',
        type: 'string',
        location: 'url',
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'path',
        name: 'path',
        type: 'string',
        location: 'url',
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'variable1',
        name: 'variable1',
        type: 'string',
        location: 'url',
      });
    });

    it('should get single function argument from body', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '{"variable1": "{{variable1}}"}',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(1);
      expect(functionArguments[0]).toMatchObject({
        key: 'variable1',
        name: 'variable1',
        type: 'string',
        location: 'body',
      });
    });

    it('should get multiple function arguments from body', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '{"variable1": "{{variable1}}", "variable2": "{{variable2}}", "variable3": "{{variable3}}", "notVariable4": "notVariable4"}',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(3);
      expect(functionArguments[0]).toMatchObject({
        key: 'variable1',
        name: 'variable1',
        type: 'string',
        location: 'body',
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'variable2',
        name: 'variable2',
        type: 'string',
        location: 'body',
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'variable3',
        name: 'variable3',
        type: 'string',
        location: 'body',
      });
    });

    it('should get single function argument from headers', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '',
        headers: '[{"key": "header", "value": "{{headerVar1}}"}]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(1);
      expect(functionArguments[0]).toMatchObject({
        key: 'headerVar1',
        name: 'headerVar1',
        type: 'string',
        location: 'headers',
      });
    });

    it('should get multiple function arguments from headers', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}, {"key": "header2", "value": "{{headerVar2}}"}, {"key": "header3","value": "{{headerVar3}}"}, {"key": "header4", "value": "value4"}]',
        auth: '',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(3);
      expect(functionArguments[0]).toMatchObject({
        key: 'headerVar1',
        name: 'headerVar1',
        type: 'string',
        location: 'headers',
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'headerVar2',
        name: 'headerVar2',
        type: 'string',
        location: 'headers',
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'headerVar3',
        name: 'headerVar3',
        type: 'string',
        location: 'headers',
      });
    });

    it('should get single function argument from auth', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '',
        headers: '[]',
        auth: '{"auth": "{{authVar1}}"}',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(1);
      expect(functionArguments[0]).toMatchObject({
        key: 'authVar1',
        name: 'authVar1',
        type: 'string',
      });
    });

    it('should get multiple function arguments from auth', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: '',
        headers: '[]',
        auth: '{"auth1": "{{authVar1}}", "auth2": "{{authVar2}}", "auth3": "{{authVar3}}", "auth4": "value4"}',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(3);
      expect(functionArguments[0]).toMatchObject({
        key: 'authVar1',
        name: 'authVar1',
        type: 'string',
        location: 'auth',
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'authVar2',
        name: 'authVar2',
        type: 'string',
        location: 'auth',
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'authVar3',
        name: 'authVar3',
        type: 'string',
        location: 'auth',
      });
    });

    it('should get multiple function arguments from all the parameters', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0]).toMatchObject({
        key: 'variable1',
        name: 'variable1',
        type: 'string',
        location: 'url',
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'headerVar1',
        name: 'headerVar1',
        type: 'string',
        location: 'headers',
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'authVar1',
        name: 'authVar1',
        type: 'string',
        location: 'auth',
      });
      expect(functionArguments[3]).toMatchObject({
        key: 'bodyVar1',
        name: 'bodyVar1',
        type: 'string',
        location: 'body',
      });
    });

    it('should filter function arguments with the same name', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable}}',
        body: '{"bodyVar1": "{{variable}}"}',
        headers: '[{"key": "header1", "value": "{{variable}}"}]',
        auth: '{"auth1": "{{variable}}"',
        argumentsMetadata: '{}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(1);
      expect(functionArguments[0]).toMatchObject({
        key: 'variable',
        name: 'variable',
        type: 'string',
      });
    });

    it('should get function arguments with type: string by default', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].type).toEqual('string');
      expect(functionArguments[1].type).toEqual('string');
      expect(functionArguments[2].type).toEqual('string');
      expect(functionArguments[3].type).toEqual('string');
    });

    it('should get function arguments with type from meta', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '{"variable1": {"type": "number"}, "headerVar1": {"type": "boolean"}, "authVar1": {"type": "object"}, "bodyVar1": {"type": "string"}}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].type).toEqual('number');
      expect(functionArguments[1].type).toEqual('boolean');
      expect(functionArguments[2].type).toEqual('object');
      expect(functionArguments[3].type).toEqual('string');
    });

    it('should get functions arguments with required: true by default', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].required).toEqual(true);
      expect(functionArguments[1].required).toEqual(true);
      expect(functionArguments[2].required).toEqual(true);
      expect(functionArguments[3].required).toEqual(true);
    });

    it('should get required from meta', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '{"variable1": {"required": false}, "headerVar1": {"required": false}, "authVar1": {"required": false}, "bodyVar1": {"required": false}}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].required).toEqual(false);
      expect(functionArguments[1].required).toEqual(false);
      expect(functionArguments[2].required).toEqual(false);
      expect(functionArguments[3].required).toEqual(false);
    });

    it('should get sort function arguments to have required first', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '{"variable1": {"required": false}, "headerVar1": {"required": true}, "authVar1": {"required": false}, "bodyVar1": {"required": true}}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0]).toMatchObject({
        key: 'headerVar1',
        required: true,
      });
      expect(functionArguments[1]).toMatchObject({
        key: 'bodyVar1',
        required: true,
      });
      expect(functionArguments[2]).toMatchObject({
        key: 'variable1',
        required: false,
      });
      expect(functionArguments[3]).toMatchObject({
        key: 'authVar1',
        required: false,
      });
    });

    it('should get functions arguments with payload: false by default', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].payload).toEqual(false);
      expect(functionArguments[1].payload).toEqual(false);
      expect(functionArguments[2].payload).toEqual(false);
      expect(functionArguments[3].payload).toEqual(false);
    });

    it('should get functions arguments with no payload from meta', () => {
      const apiFunction: ApiFunctionArguments = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '{"variable1": {"payload": true}, "headerVar1": {"payload": true}, "authVar1": {"payload": true}, "bodyVar1": {"payload": true}}',
        graphqlIntrospectionResponse: null
      };

      const functionArguments = functionService['getFunctionArguments'](apiFunction);
      expect(functionArguments).toHaveLength(4);
      expect(functionArguments[0].payload).toEqual(true);
      expect(functionArguments[1].payload).toEqual(true);
      expect(functionArguments[2].payload).toEqual(true);
      expect(functionArguments[3].payload).toEqual(true);
    });
  });

  describe('getArgumentValueMap', () => {
    it('should return all arguments from API function with empty values', async () => {
      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {});
      expect(result).toEqual({
        variable1: undefined,
        bodyVar1: undefined,
        headerVar1: undefined,
        authVar1: undefined,
      });
    });

    it('should return all arguments from API function with passed arguments', async () => {
      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {
        variable1: 'test1',
        bodyVar1: 'test2',
        headerVar1: 'test3',
        authVar1: 'test4',
      });
      expect(result).toEqual({
        variable1: 'test1',
        bodyVar1: 'test2',
        headerVar1: 'test3',
        authVar1: 'test4',
      });
    });

    it('should look for payload arguments', async () => {
      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '{"variable1": {"payload": false}, "headerVar1": {"payload": true}, "authVar1": {"payload": true}, "bodyVar1": {"payload": false}}',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {
        variable1: 'test1',
        bodyVar1: 'test2',
        payload: {
          headerVar1: 'test3',
          authVar1: 'test4',
        },
      });
      expect(result).toEqual({
        variable1: 'test1',
        bodyVar1: 'test2',
        headerVar1: 'test3',
        authVar1: 'test4',
      });
    });

    it('should treat some escape characters from arg values', async () => {
      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {
        variable1: 'test\n\r\t\f\e1',
      });
      expect(result).toEqual({
        variable1: 'test\\n\\r\\t\\fe1',
      });
    });

    it('should stringify object type argument', async () => {
      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {
        variable1: {
          test: 'test1',
        },
      });
      expect(result).toEqual({
        variable1: '{"test":"test1"}',
      });
    });

    it('should return undefined when accessing variable that does not exist', async () => {
      variableServiceMock.findByPath?.mockImplementation(() => Promise.resolve(null));

      const apiFunction = {
        environmentId: 'environmentId',
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{ "variable1": { "variable": "json.postId" } }',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {});
      expect(variableServiceMock.findByPath).toHaveBeenCalledWith('environmentId', null, 'json.postId');
      expect(result).toEqual({
        variable1: undefined,
      });
    });

    it('should return the value of the variable when accessing a variable that exists', async () => {
      const mockVariable: Variable = {
        id: 'variableId',
        createdAt: new Date(),
        environmentId: 'environmentId',
        name: 'postId',
        context: 'json',
        description: '',
        secret: false,
        visibility: Visibility.Environment,
      };
      variableServiceMock.findByPath?.mockImplementation(() => Promise.resolve(mockVariable));
      variableServiceMock.getVariableValue?.mockImplementation(() => Promise.resolve('testValue'));

      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        environmentId: 'environmentId',
        body: '',
        headers: '[]',
        auth: '',
        argumentsMetadata: '{ "variable1": { "variable": "json.postId" } }',
      } as ApiFunction;

      const result = await functionService['getArgumentValueMap'](apiFunction, {});

      expect(variableServiceMock.findByPath).toHaveBeenCalledWith('environmentId', null, 'json.postId');
      expect(variableServiceMock.getVariableValue).toHaveBeenCalledWith(mockVariable);
      expect(result).toEqual({
        variable1: 'testValue',
      });
    });
  });

  describe('executeApiFunction', () => {
    const testResponseBody = {
      value: 'testResponse',
    };
    let requestSpy: jest.SpyInstance;

    beforeEach(() => {
      httpServiceMock.request?.mockImplementation(() => of({
        data: testResponseBody,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as AxiosResponse));
      requestSpy = jest.spyOn(httpServiceMock, 'request');
    });

    it('should execute api function with url, method, headers and data specified in function', async () => {
      jest.spyOn(functionService as any, 'getBodyData')
        .mockImplementationOnce(body => body);

      const url = 'https://jsonplaceholder.typicode.com/posts';
      const method = 'POST';
      const headers = '[{"key": "header1", "value": "headerValue1"}]';
      const body = '{"body1": "bodyValue1"}';
      const apiFunction = {
        method,
        url,
        headers,
        body,
      } as ApiFunction & { environment: Environment };

      const result = await functionService.executeApiFunction(apiFunction, {});
      expect(requestSpy).toHaveBeenCalledWith({
        data: {
          body1: 'bodyValue1',
        },
        headers: {
          header1: 'headerValue1',
        },
        params: {},
        method,
        url,
      });
      expect(result).toEqual({
        data: testResponseBody,
        status: 200,
        headers: {},
      });
    });

    it('should execute api function with variable values given', async () => {
      jest.spyOn(functionService as any, 'getBodyData')
        .mockImplementationOnce(body => body);

      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        method: 'GET',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
      } as ApiFunction & { environment: Environment };

      const result = await functionService.executeApiFunction(apiFunction, {
        variable1: 'test1',
        bodyVar1: 'test2',
        headerVar1: 'test3',
        authVar1: 'test4',
      });
      expect(requestSpy).toHaveBeenCalledWith({
        data: { bodyVar1: 'test2' },
        headers: { header1: 'test3' },
        params: {},
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts/test1',
      });
      expect(result).toEqual({
        data: testResponseBody,
        status: 200,
        headers: {},
      });
    });

    it('should return error when error in request occurs', async () => {
      jest.spyOn(functionService as any, 'getBodyData')
        .mockImplementationOnce(body => body);

      requestSpy.mockImplementationOnce(() => throwError(() =>
        new AxiosError(
          'testError',
          '500',
          undefined,
          undefined,
          {
            data: testResponseBody,
            status: 500,
            statusText: 'Internal Server Error',
            headers: {},
          } as AxiosResponse,
        ),
      ));

      const apiFunction = {
        url: 'https://jsonplaceholder.typicode.com/posts/{{variable1}}',
        body: '{"bodyVar1": "{{bodyVar1}}"}',
        method: 'GET',
        headers: '[{"key": "header1", "value": "{{headerVar1}}"}]',
        auth: '{"auth1": "{{authVar1}}"}',
        argumentsMetadata: '',
        environment: {
          tenant: {
            id: 'tenantId',
          },
        } as any,
      } as ApiFunction & { environment: Environment };

      const result = await functionService.executeApiFunction(apiFunction, {});
      expect(result).toEqual({
        data: testResponseBody,
        status: 500,
        headers: {},
      });
    });
  });

  describe('filterJSONComments', () => {
    it('should filter out // comments from JSON string', () => {
      const jsonString = `{
        "test": "test1", // comment
        "test2": "test2", // comment
        // comment1
        // comment2
        "test3": "test3"
      }`;

      // @ts-ignore
      const result = functionService.filterJSONComments(jsonString);
      expect(JSON.parse(result)).toEqual({
        test: 'test1',
        test2: 'test2',
        test3: 'test3',
      })
    });

    it('should filter out /* */ comments from JSON string', () => {
      const jsonString = `{
        "test": "test1", /* comment */
        "test2": "test2", /* comment */
        /* comment1 */
        /* comment2 */
        "test3": "test3"
      }`;

      // @ts-ignore
      const result = functionService.filterJSONComments(jsonString);
      expect(JSON.parse(result)).toEqual({
        test: 'test1',
        test2: 'test2',
        test3: 'test3',
      })
    });
  });
});

/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';
import { CommonService } from 'common/common.service';
import { Test } from '@nestjs/testing';
import { configServiceMock } from '../mocks';
import { ConfigService } from 'config/config.service';

describe('CommonService', () => {
  let commonService: CommonService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommonService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    commonService = moduleRef.get<CommonService>(CommonService);
  });

  describe('checkPolyTrainingScriptVersion', () => {
    it('should throw when server script is not valid semver', () => {
      const clientVersion = '1.1.0';
      const serverVersion = '1.1.';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).toThrowError();
    });
    it('should throw when client script is not valid semver', () => {
      const clientVersion = '1.1.';
      const serverVersion = '1.1.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).toThrowError();
    });
    it('should throw when major versions differ', () => {
      const clientVersion = '0.1.0';
      const serverVersion = '1.1.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).toThrowError();
    });
    it('should NOT throw when the client version is not present (undefined) and not required', () => {
      const clientVersion = undefined;
      const serverVersion = '0.1.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).not.toThrowError();
    });
    it('should throw when the client version is not present (undefined) and required', () => {
      const clientVersion = undefined;
      const serverVersion = '0.1.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion, true)).toThrowError();
    });
    it('should throw when the minor versions differ', () => {
      const clientVersion = '1.1.0';
      const serverVersion = '1.2.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).toThrowError();
    });
    it('should throw when the minor versions differ and the major is 0', () => {
      const clientVersion = '0.1.0';
      const serverVersion = '0.2.0';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).toThrowError();
    });
    it('should NOT throw when the patches differ', () => {
      const clientVersion = '0.1.0';
      const serverVersion = '0.1.3';
      expect(() => commonService.checkPolyTrainingScriptVersion(clientVersion, serverVersion)).not.toThrowError();
    });
  });

  describe('trimDownObject', () => {
    it('should return an array with first item on root level', async () => {
      const obj = ['Tom', 'Jerry', 'Garfield'];

      expect(commonService.trimDownObject(obj)).toEqual(['Tom']);
    });

    it('should return an array with first item on first level', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: ['Tom'],
      });
    });

    it('should return an array with two first items when maxItems is 2', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
      };

      expect(commonService.trimDownObject(obj, 2)).toEqual({
        location: 'London',
        cats: ['Tom', 'Jerry'],
      });
    });

    it('should return multiple arrays with first item on first level', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
        dogs: ['Spike', 'Pluto', 'Scooby Doo'],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: ['Tom'],
        dogs: ['Spike'],
      });
    });

    it('should return arrays with first item on second level', async () => {
      const obj = {
        location: 'London',
        animals: {
          cats: ['Tom', 'Jerry', 'Garfield'],
          dogs: ['Spike', 'Pluto', 'Scooby Doo'],
        },
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        animals: {
          cats: ['Tom'],
          dogs: ['Spike'],
        },
      });
    });

    it('should return arrays with first item inside another arrays', async () => {
      const obj = {
        location: 'London',
        cats: [
          {
            name: 'Tom',
            achievements: ['killed Jerry', 'killed Garfield'],
          },
          {
            name: 'Jerry',
            achievements: ['killed Tom', 'killed Garfield'],
          },
        ],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: [
          {
            name: 'Tom',
            achievements: ['killed Jerry'],
          },
        ],
      });
    });
  });

  describe('extractComments', () => {
    it('should return an empty object when no property comments are present', async () => {
      const value = `
{
  "foo": "value1",
  "bar": "value2",
  "nested": {
    "foo": "value3",
    "bar": "value4"
  }
}
`;

      // @ts-ignore
      expect(commonService.extractComments(value)).toEqual({});
    });

    it('should return an comments for properties when property comments are present', async () => {
      const value = `
{
  // This is a comment for foo
  /*that was*/
  "foo" /* separated */ : /* into multiple */ "value1", // parts
  // Same can be done
  "bar": "value2" /* for bar */,
  // And for nested properties
  "nested": {
    // This is a comment for foo of nested
    "foo": "value3", // property
    // This is a comment for bar of nested
    "bar" /* property */: "value4"
  }
  // the same can be achieved
}
`;

      // @ts-ignore
      expect(commonService.extractComments(value)).toEqual({
        foo: 'This is a comment for foo\nthat was\nseparated\ninto multiple\nparts',
        bar: 'Same can be done\nfor bar',
        nested: 'And for nested properties\nthe same can be achieved',
        'nested.foo': 'This is a comment for foo of nested\nproperty',
        'nested.bar': 'This is a comment for bar of nested\nproperty',
      });
    });
    it('should return an comments for array properties when property comments are present', async () => {
      const value = `
{
  // before:bar
  "bar": [ // before:0
    // before:0
    "baz" // after-value:0
    // after-value:0
    , // after:0
    "quux"
    // after:1
  ] // after:bar
  // after:bar
}
`;

      // @ts-ignore
      expect(commonService.extractComments(value)).toEqual({
        bar: 'before:bar\nafter:bar\nafter:bar',
        'bar.[]': 'before:0\nbefore:0\nafter-value:0\nafter-value:0\nafter:0\nafter:1',
      });
    });

    it('should return an comments for array with nested properties when property comments are present', async () => {
      const value = `
{
  "bar": [
    // before:0
    {
      // before:item0
      "item": "item0" // after-value:item0
    }, // after:0
    // before:1
    {
      // before:item1
      "item": "item1" // after-value:item1
    } // after:1
  ]
}
`;

      // @ts-ignore
      expect(commonService.extractComments(value)).toEqual({
        'bar.[]': 'before:0\nafter:0\nbefore:1\nafter:1',
        'bar.[].item': 'before:item0\nafter-value:item0\nbefore:item1\nafter-value:item1',
      });
    });
  });

  describe('enhanceJSONSchemaWithComments', () => {
    const schema: Record<string, any> = {
      type: 'object',
      definitions: {
        ReferencedProperty: {
          type: 'object',
          properties: {
            propertyA: {
              type: 'string',
            },
            propertyB: {
              type: 'array',
              items: {
                $ref: '#/definitions/ReferencedItem',
              },
            },
          },
        },
        ReferencedItem: {
          type: 'object',
          properties: {
            itemA: {
              type: 'string',
            },
          },
        },
      },
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          type: 'string',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: {
                type: 'string',
              },
            },
          },
        },
        nested: {
          type: 'object',
          properties: {
            nestedFoo: {
              type: 'string',
            },
            nestedBar: {
              type: 'string',
            },
          },
        },
        referencedProperty: {
          $ref: '#/definitions/ReferencedProperty',
        },
      },
    };

    it('should return the same schema when no property comments are present', async () => {
      const jsoncString = `
{
  "foo": "value1",
  "bar": "value2",
  "items": [
    {
      "item": "item1"
    },
    {
      "item": "item2"
    }
  ],
  "nested": {
    "foo": "value3",
    "bar": "value4"
  }
}      
      `;

      // @ts-ignore
      expect(commonService.enhanceJSONSchemaWithComments(schema, jsoncString)).toEqual(schema);
    });

    it('should return the schema with added descriptions for 1st level properties when property comments are present', async () => {
      const jsoncString = `
{
  // This is a comment for
  "foo": "value1", // foo
  "bar": "value2", // bar
  // This is a comment for items
  "items": [
    {
      "item": "item1"
    },
    {
      "item": "item2"
    }
  ],
  // This is a comment for nested
  "nested": {
    "foo": "value3",
    "bar": "value4"
  }
}      
      `;

      const expectedSchema = _.cloneDeep(schema);
      expectedSchema.properties.foo.description = 'This is a comment for\nfoo';
      expectedSchema.properties.bar.description = 'bar';
      expectedSchema.properties.items.description = 'This is a comment for items';
      expectedSchema.properties.nested.description = 'This is a comment for nested';

      // @ts-ignore
      expect(commonService.enhanceJSONSchemaWithComments(schema, jsoncString)).toEqual(expectedSchema);
    });

    it('should return the schema with added descriptions for array item properties when property comments are present', async () => {
      const jsoncString = `
{
  "foo": "value1",
  "bar": "value2",
  // This is a comment for items
  "items": [
    {
      // This is a comment for item
      "item": "item1"
    },
    {
      // This is a also comment for item
      "item": "item2"
    }
  ],
  "nested": {
    "foo": "value3",
    "bar": "value4"
  }
}      
      `;

      const expectedSchema = _.cloneDeep(schema);
      expectedSchema.properties.items.description = 'This is a comment for items';
      expectedSchema.properties.items.items.properties.item.description = 'This is a comment for item\nThis is a also comment for item';

      // @ts-ignore
      expect(commonService.enhanceJSONSchemaWithComments(schema, jsoncString)).toEqual(expectedSchema);
    });

    it('should return the schema with added descriptions for refs', async () => {
      const jsoncString = `
{
  // This is a comment for referencedProperty
  "referencedProperty": {
    // This is a comment for propertyA
    "propertyA": "value1",
    // This is a comment for propertyB
    "propertyB": [
      {
        // This is a comment for itemA
        "itemA": "value2"
      },
      {
        // This is a also comment for itemA
        "itemA": "value3"
      }
    ]
  },
}      
      `;

      const expectedSchema = _.cloneDeep(schema);
      expectedSchema.definitions.ReferencedProperty.description = 'This is a comment for referencedProperty';
      expectedSchema.definitions.ReferencedProperty.properties.propertyA.description = 'This is a comment for propertyA';
      expectedSchema.definitions.ReferencedProperty.properties.propertyB.description = 'This is a comment for propertyB';
      expectedSchema.definitions.ReferencedItem.properties.itemA.description = 'This is a comment for itemA\nThis is a also comment for itemA';

      // @ts-ignore
      expect(commonService.enhanceJSONSchemaWithComments(schema, jsoncString)).toEqual(expectedSchema);
    });
  });
});

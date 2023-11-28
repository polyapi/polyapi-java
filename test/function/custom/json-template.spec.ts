import { JsonTemplate, POLY_ARG_NAME_KEY } from 'function/custom/json-template/index';
import { ArgMetadata, JsonTemplateProcessor } from 'function/custom/json-template/json-template';

describe('json-template', () => {
  const jsonTemplate: JsonTemplateProcessor = new JsonTemplate();

  describe('parse', () => {
    it('Should get same object structure replacing arguments by `ArgMetadata` object.', () => {
      const result = jsonTemplate.parse(`
            {
                "name": {{name}},
                "lastName": "{{lastName}}",
                "list": [
                    {{title}},
                    2,
                    "3",
                    null,
                    false
                ]
            }
      `);

      expect(result).toStrictEqual({
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: false,
        },
        lastName: {
          [POLY_ARG_NAME_KEY]: 'lastName',
          quoted: true,
        },
        list: [
          {
            [POLY_ARG_NAME_KEY]: 'title',
            quoted: false,
          },
          2,
          '3',
          null,
          false,
        ],
      });
    });

    it('Should support duplicated arguments.', () => {
      const result = jsonTemplate.parse(`
            {
                "name": {{name}},
                "lastName": "{{name}}",
                "list": [
                    "{{item}}",
                    {{item}}
                ]
            }
      `);

      expect(result).toStrictEqual({
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: false,
        },
        lastName: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: true,
        },
        list: [
          {
            [POLY_ARG_NAME_KEY]: 'item',
            quoted: true,
          },
          {
            [POLY_ARG_NAME_KEY]: 'item',
            quoted: false,
          },
        ],
      });
    });

    it('Should not transform arguments concatenated with other string content.', () => {
      const result = jsonTemplate.parse(`
            {
                "name": "The name is {{name}}"
            }
        `);

      expect(result).toStrictEqual({
        name: 'The name is {{name}}',
      });
    });

    it(`Should return ${POLY_ARG_NAME_KEY} object in root level.`, () => {
      const result = jsonTemplate.parse('{{data}}');

      expect(result).toStrictEqual({
        [POLY_ARG_NAME_KEY]: 'data',
        quoted: false,
      });
    });
  });

  describe('render', () => {
    it('Should be able to send an object inside a double quoted arg.', () => {
      const templateObject = {
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: true,
        },
        keywords: [
          {
            [POLY_ARG_NAME_KEY]: 'firstTag',
            quoted: true,
          },
        ],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          name: 'foo',
          firstTag: 'typescript',
        },
      );

      expect(result).toStrictEqual({
        name: 'foo',
        keywords: ['typescript'],
      });
    });

    it('Should be able to send a string inside a non-quoted arg.', () => {
      const templateObject = {
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: false,
        },
        keywords: [
          {
            [POLY_ARG_NAME_KEY]: 'firstTag',
            quoted: false,
          },
        ],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          name: 'foo',
          firstTag: 'typescript',
        },
      );

      expect(result).toStrictEqual({
        name: 'foo',
        keywords: ['typescript'],
      });
    });

    it('Should be able to send an string containing double quotes through a quoted arg.', () => {
      const templateObject = {
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: true,
        },
        keywords: [
          {
            [POLY_ARG_NAME_KEY]: 'firstTag',
            quoted: true,
          },
        ],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          name: '"foo"',
          firstTag: '"typescript"',
        },
      );

      expect(result).toStrictEqual({
        name: '"foo"',
        keywords: ['"typescript"'],
      });
    });

    it('Should be able to send an object in a double quoted arg.', () => {
      const templateObject = {
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: true,
        },
        keywords: [
          {
            [POLY_ARG_NAME_KEY]: 'firstTag',
            quoted: true,
          },
        ],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          name: { foo: 'bar' },
          firstTag: { foo: 'bar' },
        },
      );

      expect(result).toStrictEqual({
        name: { foo: 'bar' },
        keywords: [{ foo: 'bar' }],
      });
    });

    it('Should respect all json data types.', () => {
      const templateObject = {
        name: 'bar',
        lastName: null,
        boolean: false,
        boolean2: true,
        data: {
          list: [1, false, null, 'lorem ipsum'],
          innerData: {
            name: 'bar',
            lastName: null,
          },
        },
        list: [1, false, null, 'lorem ipsum'],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          name: { foo: 'bar' },
          firstTag: { foo: 'bar' },
        },
      );

      expect(result).toStrictEqual(templateObject);
    });

    it('Should respect boolean and number types if argument is surrounded by double quotes.', () => {
      const templateObject = {
        age: {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: true,
        },
        vip: {
          [POLY_ARG_NAME_KEY]: 'vip',
          quoted: true,
        },
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          age: 27,
          vip: true,
        },
      );

      expect(result).toStrictEqual({
        age: '27',
        vip: 'true',
      });
    });

    it('Should be able to replace arguments inside strings with content.', () => {
      const age = 27;
      const name = 'Foo';
      const templateObject = {
        ageDescription: 'My age is {{age}} and my name is {{name}}.',
        ageDescription2: 'My age is {{{{age}}}}',
        age: {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: false,
        },
        list:
        [
          {
            [POLY_ARG_NAME_KEY]: 'age',
            quoted: false,
          },
          'My age is {{age}}.',
        ],
      };

      const result = jsonTemplate.render(
        templateObject,
        {
          age,
          name,
        },
      );

      expect(result).toStrictEqual({
        ageDescription: `My age is ${age} and my name is ${name}.`,
        ageDescription2: `My age is {{${age}}}`,
        age,
        list: [
          age,
          `My age is ${age}.`,
        ],
      });
    });

    it('Should be able to process a root level argument.', () => {
      const templateObject = {
        [POLY_ARG_NAME_KEY]: 'data',
        quoted: false,
      };

      const result = jsonTemplate.render(templateObject, { data: { foo: 'bar' } });

      expect(result).toStrictEqual({ foo: 'bar' });
    });

    it('Should replace argument with en empty string if value is `undefined`.', () => {
      const templateObject = {
        otherTitle: 'This is {{title}}',
        title: '{{title}}',
      };

      const result = jsonTemplate.render(templateObject, {});

      expect(result).toStrictEqual({ title: '', otherTitle: 'This is ' });
    });

    it('Should return an empty string on quoted arguments if arg value is undefined.', () => {
      const templateObject = {
        name: {
          [POLY_ARG_NAME_KEY]: 'name',
          quoted: true,
        },
      };

      const result = jsonTemplate.render(templateObject, {});

      expect(result).toStrictEqual({ name: '' });
    });
  });

  describe('toTemplateString', () => {
    it('Should transform quoted arguments properly.', () => {
      const parsedTemplate = {
        age: {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: true,
        },
        list: [
          {
            [POLY_ARG_NAME_KEY]: 'age',
            quoted: true,
          }, {
            data: {
              [POLY_ARG_NAME_KEY]: 'age',
              quoted: true,
            },
          },
        ],
      } as {
        age: ArgMetadata,
        list: [ArgMetadata, { data: ArgMetadata }]
      };

      const parsedTemplate2 = [
        {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: true,
        }, {
          data: {
            [POLY_ARG_NAME_KEY]: 'age',
            quoted: true,
          },
        },
      ] as [ArgMetadata, { data: ArgMetadata }];

      const parsedTemplateStringVersion1 = '{"age":{"$polyArgName":"age","quoted":true},"list":[{"$polyArgName":"age","quoted":true},{"data":{"$polyArgName":"age","quoted": true}}]}';
      const parsedTemplateStringVersion2 = '[{"$polyArgName":"age","quoted":true},{"data":{"$polyArgName":"age","quoted":true}}]';

      const result = jsonTemplate.toTemplateString(parsedTemplate, false);
      const result2 = jsonTemplate.toTemplateString(parsedTemplate2, false);
      const result3 = jsonTemplate.toTemplateString(parsedTemplateStringVersion1);
      const result4 = jsonTemplate.toTemplateString(parsedTemplateStringVersion2);

      expect(result).toBe('{"age":"{{age}}","list":["{{age}}",{"data":"{{age}}"}]}');
      expect(result2).toBe('["{{age}}",{"data":"{{age}}"}]');

      // Check parsing strings.
      expect(result3).toBe('{"age":"{{age}}","list":["{{age}}",{"data":"{{age}}"}]}');
      expect(result4).toBe('["{{age}}",{"data":"{{age}}"}]');
    });

    it('Should transform unquoted arguments properly.', () => {
      const parsedTemplate = {
        age: {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: false,
        },
        list: [
          {
            [POLY_ARG_NAME_KEY]: 'age',
            quoted: false,
          }, {
            data: {
              [POLY_ARG_NAME_KEY]: 'age',
              quoted: false,
            },
          },
        ],
      } as {
        age: ArgMetadata,
        list: [ArgMetadata, { data: ArgMetadata }]
      };

      const parsedTemplate2 = [
        {
          [POLY_ARG_NAME_KEY]: 'age',
          quoted: false,
        }, {
          data: {
            [POLY_ARG_NAME_KEY]: 'age',
            quoted: false,
          },
        },
      ] as [ArgMetadata, { data: ArgMetadata }];

      const parsedTemplateStringVersion1 = '{"age":{"$polyArgName":"age","quoted":false},"list":[{"$polyArgName":"age","quoted":false},{"data":{"$polyArgName":"age","quoted": false}}]}';
      const parsedTemplateStringVersion2 = '[{"$polyArgName":"age","quoted":false},{"data":{"$polyArgName":"age","quoted":false}}]';

      const result = jsonTemplate.toTemplateString(parsedTemplate, false);
      const result2 = jsonTemplate.toTemplateString(parsedTemplate2, false);
      const result3 = jsonTemplate.toTemplateString(parsedTemplateStringVersion1);
      const result4 = jsonTemplate.toTemplateString(parsedTemplateStringVersion2);

      expect(result).toBe('{"age":{{age}},"list":[{{age}},{"data":{{age}}}]}');
      expect(result2).toBe('[{{age}},{"data":{{age}}}]');

      // Check parsing strings.
      expect(result3).toBe('{"age":{{age}},"list":[{{age}},{"data":{{age}}}]}');
      expect(result4).toBe('[{{age}},{"data":{{age}}}]');
    });

    it('Should respect rest of json types properly.', () => {
      const parsedTemplate = {
        age: 27,
        name: 'test',
        vip: false,
        moreData: null,
        list: [
          1, false, null, {
            list: [1, false, null],
          },
        ],
      };

      const parsedTemplate2 = [
        1, false, null, 'foo', {
          age: 27,
          list: [1, false, null, 'foo', { age: 27 }],
        },
      ];

      const parsedTemplateStringVersion1 = '{"age":27,"name":"test","vip":false,"moreData":null,"list":[1,false,null,{"list":[1,false,null]}]}';
      const parsedTemplateStringVersion2 = '[1,false,null,"foo",{"age":27,"list":[1,false,null,"foo",{"age":27}]}]';

      const result = jsonTemplate.toTemplateString(parsedTemplate, false);
      const result2 = jsonTemplate.toTemplateString(parsedTemplate2, false);
      const result3 = jsonTemplate.toTemplateString(parsedTemplateStringVersion1);
      const result4 = jsonTemplate.toTemplateString(parsedTemplateStringVersion2);

      expect(result).toBe('{"age":27,"name":"test","vip":false,"moreData":null,"list":[1,false,null,{"list":[1,false,null]}]}');
      expect(result2).toBe('[1,false,null,"foo",{"age":27,"list":[1,false,null,"foo",{"age":27}]}]');

      // Check parsing strings.
      expect(result3).toBe(parsedTemplateStringVersion1);
      expect(result4).toBe(parsedTemplateStringVersion2);
    });

    it('Should prettify template string.', () => {
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');

      const parsedTemplate = { foo: { [POLY_ARG_NAME_KEY]: 'foo', quoted: false } };

      jsonTemplate.toTemplateString(parsedTemplate, true);

      expect(jsonStringifySpy).toHaveBeenCalledWith(parsedTemplate, null, 4);
    });
  });

  describe('filterComments', () => {
    it('should filter out // comments from JSON string', () => {
      const jsonString = `{
        "test": "test1", // comment
        "test2": "test2", // comment
        // comment1
        // comment2
        "test3": "test3"
      }`;

      const result = jsonTemplate.filterComments(jsonString);
      expect(JSON.parse(result)).toEqual({
        test: 'test1',
        test2: 'test2',
        test3: 'test3',
      });
    });

    it('should filter out /* */ comments from JSON string', () => {
      const jsonString = `{
        "test": "test1", /* comment */
        "test2": "test2", /* comment */
        /* comment1 */
        /* comment2 */
        "test3": "test3"
      }`;

      const result = jsonTemplate.filterComments(jsonString);
      expect(JSON.parse(result)).toEqual({
        test: 'test1',
        test2: 'test2',
        test3: 'test3',
      });
    });
  });
});

import hls from 'highlight.js';
import { parse, HTMLElement } from 'node-html-parser';
import { getExtendedJsonLanguage, LANGUAGE_NAME } from './extended-json-language';
import { ARGUMENT_PATTERN } from '../constants';
import { cloneDeep, isPlainObject } from 'lodash';
import { JsonTemplateProcessor, TemplateValue, POLY_ARG_NAME_KEY, ArgMetadata } from './json-template';
import hljs from 'highlight.js';

hls.registerLanguage(LANGUAGE_NAME, getExtendedJsonLanguage);

export * from './json-template';

export const isTemplateArg = (value): value is ArgMetadata => typeof value[POLY_ARG_NAME_KEY] !== 'undefined';

/* eslint-disable no-dupe-class-members */

/**
 * Use this when you need to parse and modify raw json from api functions.
*/
export class JsonTemplate implements JsonTemplateProcessor {
  parse(template: string): Record<string, TemplateValue> | TemplateValue[] {
    const { value } = hls.highlight(template, {
      language: LANGUAGE_NAME,
    });

    const dom = parse(value);

    for (const node of dom.querySelectorAll('.hljs-argument')) {
      const argName = node.innerText.replace('\{\{', '').replace('\}\}', '');

      node.textContent = `{"${POLY_ARG_NAME_KEY}": "${argName}", "quoted": false}`;
    }

    for (const node of dom.querySelectorAll('.hljs-string')) {
      if (node.textContent.match(/^"\{{2}[^\{\}]+?\}{2}"$/)) {
        const argName = node.textContent.replace('{{', '').replace('}}', '').replace(/"/g, '');

        node.textContent = `{"${POLY_ARG_NAME_KEY}": "${argName}", "quoted": true}`;
      }
    }

    this.filterCommentsFromDomObject(dom);

    return JSON.parse(dom.textContent);
  }

  render(template: string | Record<string, TemplateValue> | TemplateValue[], args: Record<string, any>): any[] | Record<string, any> {
    const result = typeof template === 'string' ? this.parse(template) : cloneDeep<ReturnType<typeof this.parse>>(template);

    if (typeof result[POLY_ARG_NAME_KEY] !== 'undefined') {
      return args[result[POLY_ARG_NAME_KEY]];
    }

    const isTemplateArg = (value): value is ArgMetadata => typeof value[POLY_ARG_NAME_KEY] !== 'undefined';

    const assignArgValues = (value: unknown) => {
      if ((isPlainObject as (value: any) => value is Record<string, any>)(value)) {
        if (isTemplateArg(value)) {
          const argValue = args[value.$polyArgName];

          if (!value.quoted) {
            return argValue;
          }

          /*
          Quoted arg, example: {"key": "{{myArg}}"}
          In this particular case we can consider that user wanted
          to send the arg value inside double quotes, so we respect that decision.
        */
          if (typeof argValue === 'boolean' || typeof argValue === 'number') {
            return `${argValue}`;
          }

          /*
          If user sends an object or an array (because it patched the argument after training)
          we should return it here as native object/array
        */
          return argValue;
        }
        for (const key of Object.keys(value)) {
          value[key] = assignArgValues(value[key]);
        }
        return value;
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = assignArgValues(value[i]);
        }
      }

      if (typeof value === 'string') {
        const matchedArgs = value.match(ARGUMENT_PATTERN);

        if (matchedArgs?.length) {
          let newValue = value;
          for (const argName of matchedArgs) {
            const argValue = args[argName];

            if (typeof args[argName] !== 'undefined') {
              newValue = newValue.replace(`{{${argName}}}`, argValue);
            }
          }

          return newValue;
        }
      }

      return value;
    };

    assignArgValues(result);

    return result as any;
  }

  toTemplateString(template: string): string
  toTemplateString(template: Record<string, TemplateValue> | TemplateValue[], prettify?: boolean): string
  toTemplateString(template: Record<string, TemplateValue> | TemplateValue[] | string, prettify = true): string {
    let value: string;

    if (typeof template === 'string') {
      const { value: hljsValue } = hljs.highlight(template, {
        language: LANGUAGE_NAME,
      });

      value = hljsValue;
    } else {
      const { value: hljsValue } = hljs.highlight(JSON.stringify(template, null, prettify ? 4 : undefined), {
        language: LANGUAGE_NAME,
      });

      value = hljsValue;
    }

    const dom = parse(value);

    for (const node of dom.querySelectorAll('.argument-object')) {
      const arg = (JSON.parse(node.textContent) as ArgMetadata);

      node.textContent = arg.quoted ? `"{{${arg[POLY_ARG_NAME_KEY]}}}"` : `{{${arg[POLY_ARG_NAME_KEY]}}}`;
    }

    return dom.textContent;
  }

  filterComments(template: string): string {
    const { value } = hls.highlight(template, {
      language: LANGUAGE_NAME,
    });

    const dom = parse(value);

    this.filterCommentsFromDomObject(dom);

    return dom.textContent;
  }

  private filterCommentsFromDomObject(dom: HTMLElement) {
    for (const node of dom.querySelectorAll('.hljs-comment')) {
      node.remove();
    }
  }

  /* eslint-enable no-dupe-class-members */
}

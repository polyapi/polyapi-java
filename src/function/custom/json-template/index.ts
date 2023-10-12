import hls from 'highlight.js';
import { parse } from 'node-html-parser';
import { getExtendedJsonLanguage, LANGUAGE_NAME } from './extended-json-language';
import { ARGUMENT_PATTERN } from '../constants';
import { cloneDeep, isPlainObject } from 'lodash';

hls.registerLanguage(LANGUAGE_NAME, getExtendedJsonLanguage);

export const POLY_ARG_NAME_KEY = '$polyArgName';

export const isTemplateArg = (value): value is ArgMetadata => typeof value[POLY_ARG_NAME_KEY] !== 'undefined';

/**
 * This function replaces all arguments from raw json string for valid objects of type {@link ArgMetadata}
 * and returns a valid json object. This is useful when you need to modify something from client json string that has
 * extended syntax `{"foo": {{myArgument}}}` and you need to modify it based on some argument state.
*/
export const getMetadataTemplateObject = (raw: string): Record<string, any> => {
  const { value } = hls.highlight(raw, {
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

  return JSON.parse(dom.textContent);
};

export type ArgMetadata = {
    /**
     * Argument name
     */
    [POLY_ARG_NAME_KEY]: string;
    /**
     * If argument is surrounded by double quotes or not in template's string.
     */
    quoted: boolean;
}

export const mergeArgumentsInTemplateObject = (templateObject: Record<string, unknown> | Record<string, unknown>[], args: Record<string, any>): typeof templateObject => {
  const clonedRawObject = cloneDeep(templateObject);

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

  assignArgValues(clonedRawObject);

  return clonedRawObject;
};

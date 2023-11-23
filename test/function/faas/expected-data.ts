export const EXPECTED_DATA = [
  {
    timestamp: '1700729421736827852',
    value: "{ property: 'value', another: 'value2' } { property: 'value', another: 'value2' }",
    level: 'ERROR',
  },
  {
    timestamp: '1700729421735282205',
    value: 'Error: error object\n' +
      '    at testLogging (/workspace/index.js:82:19)\n' +
      '    at Object.handle (/workspace/index.js:89:26)\n' +
      '    at invokeFunction (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/invoker.js:53:42)\n' +
      '    at Object.doPost (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/invocation-handler.js:16:28)\n' +
      '    at preHandlerCallback (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/handleRequest.js:137:37)\n' +
      '    at next (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:183:9)\n' +
      '    at Object.<anonymous> (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/metrics.js:148:7)\n' +
      '    at hookIterator (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:353:10)\n' +
      '    at next (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:189:18)\n' +
      '    at Object.<anonymous> (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/event-handler.js:29:5)',
    level: 'ERROR',
  },
  {
    timestamp: '1700729421735088803',
    value: 'error multiline\nline2\nline3',
    level: 'ERROR',
  },
  {
    timestamp: '1700729421735069653',
    value: 'error line',
    level: 'ERROR',
  },
  {
    timestamp: '1700729421735049603',
    value: 'this is single line of warn',
    level: 'WARN',
  },
  {
    timestamp: '1700729421735041142',
    value: "{ property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '1700729421735005902',
    value: "%c ANother with colors and object background: yellow; color: black { property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '1700729421734996212',
    value: '%c SPECIAL LINE WITH COLORS background: yellow; color: black',
    level: 'LOG',
  },
  {
    timestamp: '1700729421734983002',
    value: 'this is single line',
    level: 'LOG',
  },
  {
    timestamp: '1700726045733092195',
    value: 'Error: error object\n' +
      '    at testLogging (/workspace/index.js:82:19)\n' +
      '    at Object.handle (/workspace/index.js:88:26)\n' +
      '    at invokeFunction (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/invoker.js:53:42)\n' +
      '    at Object.doPost (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/invocation-handler.js:16:28)\n' +
      '    at preHandlerCallback (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/handleRequest.js:137:37)\n' +
      '    at next (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:183:9)\n' +
      '    at Object.<anonymous> (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/metrics.js:148:7)\n' +
      '    at hookIterator (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:353:10)\n' +
      '    at next (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/fastify/lib/hooks.js:189:18)\n' +
      '    at Object.<anonymous> (/layers/paketo-buildpacks_npm-install/launch-modules/node_modules/faas-js-runtime/lib/event-handler.js:29:5)',
    level: 'ERROR',
  },
  {
    timestamp: '1700726045732883184',
    value: 'error multiline\nline2\nline3',
    level: 'ERROR',
  },
  {
    timestamp: '1700726045732859554',
    value: 'error line',
    level: 'ERROR',
  },
  {
    timestamp: '1700726045732828514',
    value: 'this is single line of warn',
    level: 'WARN',
  },
  {
    timestamp: '1700726045732808444',
    value: "{ property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '1700726045732790814',
    value: "%c ANother with colors and object background: yellow; color: black { property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '1700726045732760004',
    value: '%c SPECIAL LINE WITH COLORS background: yellow; color: black',
    level: 'LOG',
  },
  {
    timestamp: '1700726045732746024',
    value: 'this is single line',
    level: 'LOG',
  },
];

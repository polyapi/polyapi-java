export const EXPECTED_DATA = [
  {
    timestamp: '2023-11-23T08:50:21.736827852Z',
    value: "{ property: 'value', another: 'value2' } { property: 'value', another: 'value2' }",
    level: 'ERROR',
  },
  {
    timestamp: '2023-11-23T08:50:21.735282205Z',
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
    timestamp: '2023-11-23T08:50:21.735088803Z',
    value: 'error multiline\nline2\nline3',
    level: 'ERROR',
  },
  {
    timestamp: '2023-11-23T08:50:21.735069653Z',
    value: 'error line',
    level: 'ERROR',
  },
  {
    timestamp: '2023-11-23T08:50:21.735049603Z',
    value: 'this is single line of warn',
    level: 'WARN',
  },
  {
    timestamp: '2023-11-23T08:50:21.735041142Z',
    value: "{ property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T08:50:21.735005902Z',
    value: "%c ANother with colors and object background: yellow; color: black { property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T08:50:21.734996212Z',
    value: '%c SPECIAL LINE WITH COLORS background: yellow; color: black',
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T08:50:21.734983002Z',
    value: 'this is single line',
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T07:54:05.733092195Z',
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
    timestamp: '2023-11-23T07:54:05.732883184Z',
    value: 'error multiline\nline2\nline3',
    level: 'ERROR',
  },
  {
    timestamp: '2023-11-23T07:54:05.732859554Z',
    value: 'error line',
    level: 'ERROR',
  },
  {
    timestamp: '2023-11-23T07:54:05.732828514Z',
    value: 'this is single line of warn',
    level: 'WARN',
  },
  {
    timestamp: '2023-11-23T07:54:05.732808444Z',
    value: "{ property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T07:54:05.732790814Z',
    value: "%c ANother with colors and object background: yellow; color: black { property: 'value', another: 'value2' }",
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T07:54:05.732760004Z',
    value: '%c SPECIAL LINE WITH COLORS background: yellow; color: black',
    level: 'LOG',
  },
  {
    timestamp: '2023-11-23T07:54:05.732746024Z',
    value: 'this is single line',
    level: 'LOG',
  },
];

export const EXPECTED_DATA = [
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This is an ERROR log in the greeter function',
    level: 'Error/Warning',
  },
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This is a WARN log in the greeter function',
    level: 'Error/Warning',
  },
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This is an INFO log in the greeter function',
    level: 'Info',
  },
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This is an INFO log in the greeter function',
    level: 'Info',
  },
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This is an INFO log in the greeter function',
    level: 'Info',
  },
  {
    timestamp: new Date('2023-10-30T11:39:29.302Z'),
    value: 'This should be the same line in the greeter function',
    level: 'Info',
  },
  { timestamp: new Date('2023-10-30T11:39:28.648Z'), value: '', level: 'Info' },
  {
    timestamp: new Date('2023-10-30T11:39:28.648Z'),
    value: '> FUNC_LOG_LEVEL=info faas-js-runtime ./index.js',
    level: 'Info',
  },
  {
    timestamp: new Date('2023-10-30T11:39:28.648Z'),
    value: '> http-handler@0.1.0 start',
    level: 'Info',
  },
  { timestamp: new Date('2023-10-30T11:39:28.648Z'), value: '', level: 'Info' },
  {
    timestamp: new Date('2023-10-30T11:39:27.719Z'),
    value: 'Cached Poly library found, reusing...',
    level: 'Info',
  },
  { timestamp: new Date('2023-10-30T11:36:29.556Z'), value: '', level: 'Info' },
  {
    timestamp: new Date('2023-10-30T11:36:29.556Z'),
    value: '> FUNC_LOG_LEVEL=info faas-js-runtime ./index.js',
    level: 'Info',
  },
  {
    timestamp: new Date('2023-10-30T11:36:29.556Z'),
    value: '> http-handler@0.1.0 start',
    level: 'Info',
  },
  { timestamp: new Date('2023-10-30T11:36:29.556Z'), value: '', level: 'Info' },
  {
    timestamp: new Date('2023-10-30T11:36:28.288Z'),
    value: 'Cached Poly library found, reusing...',
    level: 'Info',
  },
];

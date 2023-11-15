export const LOKI_MOCK_RESPONSE = {
  status: 'success',
  data: {
    resultType: 'streams',
    result: [
      {
        stream: {},
        values: [
          [
            '1700071770072348540',
            '2023-11-15T18:09:29.998730631Z stderr F This is an ERROR log in the greeter14 function',
          ],
          [
            '1700071770072340130',
            '2023-11-15T18:09:29.99864766Z stderr F This is a WARN log in the greeter14 function',
          ],
          [
            '1700071770072321009',
            '2023-11-15T18:09:29.998351427Z stdout F This is an INFO log in the greeter14 function',
          ],
          [
            '1700071770072310579',
            '2023-11-15T18:09:29.997974942Z stdout F Logging GermanGreeter13 in the greeter14 function message',
          ],
        ],
      },
      {
        stream: {},
        values: [],
      },
    ],
    stats: {},
  },
};

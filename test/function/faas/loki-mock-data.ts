export const LOKI_MOCK_RESPONSE = {
  status: 'success',
  data: {
    resultType: 'streams',
    result: [
      {
        stream: {
          namespace: 'development',
          node_name: 'ip-172-32-26-136.us-west-2.compute.internal',
          pod: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy4cw9k',
          stream: 'stdout',
          app: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
          container: 'user-container',
          filename:
            '/var/log/pods/development_function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy4cw9k_e21ac1b8-57fd-41de-a4d7-66e4a65c6bdf/user-container/0.log',
          job: 'development/function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
        },
        values: [],
      },
      {
        stream: {
          pod: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy5bmnb',
          stream: 'stderr',
          app: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
          container: 'user-container',
          filename:
            '/var/log/pods/development_function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy5bmnb_21b47667-ef94-44cf-a359-050b6985a5a8/user-container/0.log',
          job: 'development/function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
          namespace: 'development',
          node_name: 'ip-172-32-26-136.us-west-2.compute.internal',
        },
        values: [
          ['1698665969302995014', 'This is an ERROR log in the greeter function'],
          ['1698665969302981914', 'This is a WARN log in the greeter function'],
        ],
      },
      {
        stream: {
          node_name: 'ip-172-32-26-136.us-west-2.compute.internal',
          pod: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy5bmnb',
          stream: 'stdout',
          app: 'function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
          container: 'user-container',
          filename:
            '/var/log/pods/development_function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001-deploy5bmnb_21b47667-ef94-44cf-a359-050b6985a5a8/user-container/0.log',
          job: 'development/function-9a41e1e3-19bc-40b1-b80c-18dc58861123-00001',
          namespace: 'development',
        },
        values: [
          ['1698665969302816712', 'This is an INFO log in the greeter function'],
          ['1698665969302802602', 'This is an INFO log in the greeter function'],
          ['1698665969302739081', 'This is an INFO log in the greeter function'],
          ['1698665969302494458', 'This should be the same line in the greeter function'],
        ],
      },
    ],
    stats: {
      summary: {
        bytesProcessedPerSecond: 377713,
        linesProcessedPerSecond: 1841,
        totalBytesProcessed: 7177,
        totalLinesProcessed: 35,
        execTime: 0.019001177,
        queueTime: 0.000051641,
        subqueries: 1,
        totalEntriesReturned: 35,
      },
      querier: {
        store: {
          totalChunksRef: 0,
          totalChunksDownloaded: 0,
          chunksDownloadTime: 0,
          chunk: {
            headChunkBytes: 0,
            headChunkLines: 0,
            decompressedBytes: 0,
            decompressedLines: 0,
            compressedBytes: 0,
            totalDuplicates: 0,
          },
        },
      },
      ingester: {
        totalReached: 1,
        totalChunksMatched: 5,
        totalBatches: 1,
        totalLinesSent: 35,
        store: {
          totalChunksRef: 0,
          totalChunksDownloaded: 0,
          chunksDownloadTime: 0,
          chunk: {
            headChunkBytes: 6756,
            headChunkLines: 29,
            decompressedBytes: 421,
            decompressedLines: 6,
            compressedBytes: 345,
            totalDuplicates: 0,
          },
        },
      },
    },
  },
};

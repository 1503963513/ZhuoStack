import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/api/generated/endpoints',
      schemas: './src/api/generated/models',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: {
          path: './src/lib/api-mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});

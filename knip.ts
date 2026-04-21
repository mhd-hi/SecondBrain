import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx,css}'],
  project: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx,css}'],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].map(match => match[0]).join('\n'),
  },
};

export default config;

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.cjs',
    format: 'cjs',
    sourcemap: false,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        module: 'ESNext',
      },
    }),
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
    json(),
  ],
  external: [
    // Node.js built-in modules
    'path',
    'fs',
    'os',
    'child_process',
    'util',
    'events',
    'stream',
    'buffer',
    'crypto',
    'http',
    'https',
    'net',
    'tty',
    'zlib',
    // Runtime dependencies that pkg will handle
    '@inquirer/prompts',
    'commander',
    'dotenv',
  ],
};

import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // handles @/ path alias
    '^@/(.*)$': '<rootDir>/$1',
    // Ensure one React instance in tests even in monorepo/workspace setups.
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: { jsx: 'react-jsx' },
    }],
  },
  testMatch: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
};

export default config;
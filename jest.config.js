// https://gist.github.com/timosadchiy/87a5c3799ed44837c4d9de48a02a10bc
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src', '<rootDir>/shared'],
  testMatch: ['**/*.test.ts'],
  moduleDirectories: ['node_modules', 'src', 'shared'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^/opt/(.*)$': '<rootDir>/shared/$1',
    '~/(.*)': '<rootDir>/src',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'ts-jest',
  },
  collectCoverage: false,
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};

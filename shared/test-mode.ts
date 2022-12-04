import Environment from './enviroment';

export enum ENVIROMENT_OPTIONS {
  LOCAL = 'local',
  TEST = 'test',
  DEVELOPMENT = 'development',
  QA = 'qa',
}

export const IS_TEST_MODE =
  Environment.get('NODE_ENV')?.toLowerCase() === ENVIROMENT_OPTIONS.LOCAL ||
  Environment.get('NODE_ENV')?.toLowerCase() === ENVIROMENT_OPTIONS.TEST ||
  Environment.get('NODE_ENV')?.toLowerCase() === ENVIROMENT_OPTIONS.DEVELOPMENT ||
  Environment.get('NODE_ENV')?.toLowerCase() === ENVIROMENT_OPTIONS.QA ||
  Environment.get('AWS_SAM_LOCAL') === 'true';

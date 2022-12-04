import { Duration } from 'aws-cdk-lib';
import { LambdaDefinition, CDKContext } from '../../shared/types';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// Constants
const DEFAULT_LAMBDA_MEMORY_MB = 1024;
const DEFAULT_LAMBDA_TIMEOUT_MINS = 15;

export enum API_ENPOINTS {
  UPLOAD = 'upload',
}

export const apiEndpointKeys = Object.values(API_ENPOINTS);

// Returns lambda definitions with custom env
export const getLambdaDefinitions = (): LambdaDefinition[] => {
  const environment = {};

  const lambdaDefinitions: LambdaDefinition[] = [
    {
      name: 'upload-lambda',
      environment,
      isPrivate: false,
      methods: ['POST'],
      endpoint: API_ENPOINTS.UPLOAD,
    },
  ];
  return lambdaDefinitions;
};

// Returns Lambda Function properties with defaults and overwrites
export const getFunctionProps = (
  lambdaDefinition: LambdaDefinition,
  lambdaRole: iam.Role,
  lambdaLayer: lambda.LayerVersion,
  context: CDKContext
): NodejsFunctionProps => ({
  functionName: `${context.appName}-${lambdaDefinition.name}-${context.currentBranch}`,
  entry: `src/lambdas/${lambdaDefinition.name}.ts`,
  runtime: lambda.Runtime.NODEJS_16_X,
  memorySize: lambdaDefinition.memoryMB ? lambdaDefinition.memoryMB : DEFAULT_LAMBDA_MEMORY_MB,
  timeout: lambdaDefinition.timeoutMins
    ? Duration.minutes(lambdaDefinition.timeoutMins)
    : Duration.minutes(DEFAULT_LAMBDA_TIMEOUT_MINS),
  environment: lambdaDefinition.environment,
  role: lambdaRole,
  layers: [lambdaLayer],
  securityGroups: [],
});

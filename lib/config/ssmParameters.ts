import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnParameter, Fn, Stack } from 'aws-cdk-lib';

type ParamSet = Record<string, string>;
const paramSets: Record<string, ParamSet> = {};

const getCache = (stack: Stack) => {
  if (!paramSets[stack.stackId]) {
    paramSets[stack.stackId] = {};
  }
  return paramSets[stack.stackId];
};

export const stringParam = (stack: Stack, paramName: string) => {
  const params = getCache(stack);
  if (!params[paramName]) {
    params[paramName] = ssm.StringParameter.valueForStringParameter(stack, paramName);
  }
  return params[paramName] || '';
};

export const listParam = (stack: Stack, paramName: string) => {
  const params = getCache(stack);
  if (!params[paramName]) {
    params[paramName] = new CfnParameter(stack, paramName, {
      type: 'AWS::SSM::Parameter::Value<List<String>>',
      default: paramName,
    }).logicalId;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Fn.ref(params[paramName]) as any;
};

export const getParams = (stack: Stack) => ({
  string: (paramName: string) => stringParam(stack, paramName),
  list: (paramName: string) => listParam(stack, paramName),
});

export type Params = ReturnType<typeof getParams>;

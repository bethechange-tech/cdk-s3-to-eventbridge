#!/usr/bin/env node
import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import gitBranch from 'git-branch';
import { camelCase } from 'camel-case';

import { CDKS3Stack } from '../lib/s3-project-stack';
import { CDKContext } from '../shared/types';

// Get CDK Context based on git branch
export const getContext = async (app: cdk.App): Promise<CDKContext> => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const currentBranch = await gitBranch();

      const environment = app.node
        .tryGetContext('environments')
        .find((e: { branchName: string }) => e.branchName === currentBranch);

      const globals = app.node.tryGetContext('globals');

      return resolve({ ...globals, ...environment, currentBranch: camelCase(currentBranch) });
    } catch (error) {
      console.error(error);
      return reject();
    }
  });
};

// Create Stacks
export const createStacks = async () => {
  try {
    const app = new cdk.App();
    const context = await getContext(app);

    const tags = {
      Environment: context.currentBranch,
    };

    const stackProps: cdk.StackProps = {
      env: {
        region: context.region,
        account: context.accountNumber,
      },
      tags,
    };

    new CDKS3Stack(app, `${context.appName}-${context.currentBranch}`, stackProps, context);
  } catch (error) {
    console.error(error);
  }
};

createStacks();

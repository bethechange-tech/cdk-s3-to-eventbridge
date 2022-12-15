import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';

import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cwLogs from 'aws-cdk-lib/aws-logs';

import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration, CfnParameter } from 'aws-cdk-lib';
import { getFunctionProps, apiEndpointKeys, API_ENPOINTS } from './config/lambda-config';

import type { CDKContext } from '../shared/types';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class CDKS3Stack extends Stack {
  scope: Construct;

  context: CDKContext;

  constructor(scope: Construct, id: string, props: StackProps, context: CDKContext) {
    super(scope, id, props);

    this.context = context;
    this.scope = scope;

    const bucketName = `image-upload-bucket-${context.appName}`;

    const bucket = new s3.Bucket(this, bucketName, {
      eventBridgeEnabled: true,
      bucketName,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //Create a new bus
    const AppEventBus = new EventBus(this, 'AppEventBus', {
      eventBusName: `AppEventBus-${context.appName}`,
    });

    // configure rest api
    const restApi = new apigateway.RestApi(this, `${context.appName}-rest-api`, {
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true,
        cachingEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowHeaders: ['Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'],
        allowOrigins: ['*'],
      },
      binaryMediaTypes: ['*~1*'],
    });

    // Lambda Role
    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      roleName: `${context.appName}-lambda-role-${context.currentBranch}`,
      description: `Lambda role for ${context.appName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess')],
    });

    // ec2 Permissions for when I use database in this project
    const ec2Policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['arn:aws:ec2:eu-west-1:*:*'],
      actions: [
        'ec2:DescribeNetworkInterfaces',
        'ec2:CreateNetworkInterface',
        'ec2:DeleteNetworkInterface',
        'ec2:DescribeInstances',
        'ec2:AttachNetworkInterface',
        'ec2:DescribeAccountAttributes',
        'ec2:DescribeAvailabilityZones',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeSubnets',
        'ec2:DescribeVpcAttribute',
        'ec2:DescribeVpcs',
      ],
    });

    // cloudwatch Permissions
    const cloudWatchLogsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['arn:aws:logs:eu-west-1:*:*'],
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:PutLogEvents',
      ],
    });

    // EventBridge Permissions
    const eventbridgePutPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`${AppEventBus.eventBusArn}/*`],
      actions: ['events:PutEvents'],
    });

    // s3 Permissions
    const s3PutPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`${bucket.bucketArn}/*`],
      actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:PutObjectTagging'],
    });

    const s3ReadPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`${bucket.bucketArn}/*`],
      actions: ['s3:GetObject', 's3:ListBucket'],
    });

    // Lambda Layer
    const lambdaLayer = new lambda.LayerVersion(this, 'lambdaLayer', {
      code: lambda.Code.fromAsset('shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X, lambda.Runtime.NODEJS_18_X],
      description: `Lambda Layer for ${this.context.appName}`,
    });

    ////////////////////////////////////
    /// IMAGE UPLOAD
    /////////////////////////////////

    const imageUploadDefinition = {
      name: 'upload-s3-lambda',
      isPrivate: false,
      methods: ['POST'],
      endpoint: API_ENPOINTS.UPLOAD,
    };

    // Get function props based on lambda definition
    const imageUploadLambdaFunctionProps = getFunctionProps(
      imageUploadDefinition,
      lambdaRole,
      lambdaLayer,
      this.context
    );

    const imageUploadLambdaFunction = new NodejsFunction(
      this,
      `${imageUploadDefinition.name}-function`,
      imageUploadLambdaFunctionProps
    );

    imageUploadLambdaFunction.addEnvironment('bucketName', bucket.bucketName);
    imageUploadLambdaFunction.addEnvironment('EVENT_BUS', AppEventBus.eventBusName);

    imageUploadLambdaFunction.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: restApi.arnForExecuteApi('*'),
    });

    const [uploadEndpontKey] = apiEndpointKeys;

    const lambdaEndpoint = restApi.root.addResource(uploadEndpontKey);

    lambdaEndpoint.addMethod(
      imageUploadDefinition.methods[0],
      new apigateway.LambdaIntegration(imageUploadLambdaFunction),
      {}
    );

    bucket.grantWrite(imageUploadLambdaFunction);

    imageUploadLambdaFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 'lambda-policy', {
        statements: [s3PutPolicy, eventbridgePutPolicy, cloudWatchLogsPolicy, ec2Policy],
      })
    );

    ////////////////////////////////////
    /// IMAGE RESIZE
    /////////////////////////////////

    const imageResizeLambdaFunctionDef = {
      name: 'image-resize-eb-lambda',
      isPrivate: false,
    };

    const imageResizeLambdaFunctionProps = getFunctionProps(
      imageResizeLambdaFunctionDef,
      lambdaRole,
      lambdaLayer,
      this.context
    );

    const imageResizeLambdaFunction = new NodejsFunction(
      this,
      `${imageResizeLambdaFunctionDef.name}-function`,
      imageResizeLambdaFunctionProps
    );

    imageResizeLambdaFunction.addEnvironment('bucketName', bucket.bucketName);
    bucket.grantReadWrite(imageResizeLambdaFunction);

    imageResizeLambdaFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 's3-oeventbridge-policy', {
        statements: [
          s3PutPolicy,
          s3ReadPolicy,
          eventbridgePutPolicy,
          cloudWatchLogsPolicy,
          ec2Policy,
        ],
      })
    );

    const imageResizeEventRule = new Rule(this, 'rule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [bucket.bucketName],
          },
        },
      },
    });

    const dlQueue = new sqs.Queue(this, 'dlQueue');

    imageResizeEventRule.addTarget(
      new LambdaFunction(imageResizeLambdaFunction, {
        deadLetterQueue: dlQueue, // Optional: add a dead letter queue
        maxEventAge: Duration.hours(2), // Optional: set the maxEventAge retry policy
        retryAttempts: 3, // Optional: set the max number of retry attempts
      })
    );

    //////////////////////////////////////////
    /// AI IMAGE GENERATOR WITH OPENAI
    /////////////////////////////////////////

    const openAiImageGeneratorDefinition = {
      name: 'image-generator-openAI-lambda',
      isPrivate: false,
      methods: ['POST'],
    };

    // Get function props based on lambda definition
    const openAiImageGeneratorLambdaFunctionProps = getFunctionProps(
      openAiImageGeneratorDefinition,
      lambdaRole,
      lambdaLayer,
      this.context
    );

    const openAiImageGeneratorLambdaFunction = new NodejsFunction(
      this,
      `${openAiImageGeneratorDefinition.name}-function`,
      openAiImageGeneratorLambdaFunctionProps
    );

    openAiImageGeneratorLambdaFunction.addEnvironment(
      'OPENAI_API_KEY',
      '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'
    );

    openAiImageGeneratorLambdaFunction.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: restApi.arnForExecuteApi('*'),
    });

    openAiImageGeneratorLambdaFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 'lambda-policy-openAi', {
        statements: [cloudWatchLogsPolicy, ec2Policy],
      })
    );

    const openAiImageGeneratorLambdaEndpoint = restApi.root.addResource('openai');

    openAiImageGeneratorLambdaEndpoint
      .addResource('generateimage')
      .addMethod(
        openAiImageGeneratorDefinition.methods[0],
        new apigateway.LambdaIntegration(openAiImageGeneratorLambdaFunction),
        {}
      );

    // Create corresponding Log Group with one month retention
    new cwLogs.LogGroup(this, `fn-${openAiImageGeneratorDefinition.name}-log-group`, {
      logGroupName: `/aws/lambda/${this.context.appName}-${openAiImageGeneratorDefinition.name}-${this.context.currentBranch}`,
      retention: cwLogs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create corresponding Log Group with one month retention
    new cwLogs.LogGroup(this, `fn-${imageUploadDefinition.name}-log-group`, {
      logGroupName: `/aws/lambda/${this.context.appName}-${imageUploadDefinition.name}-${this.context.currentBranch}`,
      retention: cwLogs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create corresponding Log Group with one month retention
    new cwLogs.LogGroup(this, `fn-${imageResizeLambdaFunctionDef.name}-log-group`, {
      logGroupName: `/aws/lambda/${this.context.appName}-${imageResizeLambdaFunctionDef.name}-${this.context.currentBranch}`,
      retention: cwLogs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, 'S3BucketName', { value: bucket.bucketName });

    new CfnOutput(this, 'image_resize_lambda_arn', {
      value: imageResizeLambdaFunction.functionArn ?? 'Something went wrong with the deploy',
      exportName: 'imageResizeLambdaArn',
    });

    new CfnOutput(this, 'image_upload_lambda_arn', {
      value: imageResizeLambdaFunction.functionArn ?? 'Something went wrong with the deploy',
      exportName: 'imageUploadLambdaArn',
    });

    new CfnOutput(this, 'REST_API_URL', {
      value: restApi.url ?? 'Something went wrong with the deploy',
      exportName: 'RESTAPIURL',
    });
  }
}

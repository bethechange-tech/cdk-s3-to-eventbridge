import AWS from 'aws-sdk';

import AWSMock from 'mock-aws-s3';

import BucketAdapter, { FileFormat, UploadParams } from './BucketAdapter';

import Environment from '/opt/enviroment';
import { IS_TEST_MODE } from '/opt/test-mode';

export const s3Path = IS_TEST_MODE
  ? '/tmp/buckets/'
  : `https://${process.env.bucketName}.s3-${
      process.env?.region || process.env.AWS_REGION
    }.amazonaws.com/`;

AWSMock.config.basePath = s3Path; // Can configure a basePath for your local buckets

export default interface IBucketAdapter {
  upload({ data, fileName, extension }: UploadParams): Promise<string>;
  getObjectsByPrefixAndContentType(prefix: string, extension: FileFormat): Promise<string[]>;
  batchUpload(params: UploadParams[], chunkSize: number): Promise<string[]>;
}

export function createS3Client(isLocal = false): AWS.S3 {
  return isLocal || IS_TEST_MODE
    ? new AWSMock.S3({ apiVersion: '2006-03-01' })
    : new AWS.S3({ apiVersion: '2006-03-01' });
}

export function storageBucketAdapter(): BucketAdapter {
  AWS.config.update({ region: 'eu-west-1' });

  const s3Client = createS3Client();
  const bucketName = Environment.get('bucketName') || 'test';

  return new BucketAdapter(s3Client, bucketName);
}

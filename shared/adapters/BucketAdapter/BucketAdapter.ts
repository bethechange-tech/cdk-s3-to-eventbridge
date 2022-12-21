import PromisePool from '@supercharge/promise-pool/dist';
import AWS from 'aws-sdk';
import { PutObjectRequest, ListObjectsV2Output, GetObjectOutput } from 'aws-sdk/clients/s3';
import { chunk, flatten } from 'lodash';

import IBucketAdapter from './IBucketAdapter';
import logger from '/opt/logger';
import { redactCustomerDetails } from '/opt/RedactCustomerDetails';

export enum FileFormat {
  PDF = 'pdf',
  PNG = 'png',
}

export enum ACL_OPTIONS {
  PUBLIC_READ = 'public-read',
}

export type UploadParams = { data: Buffer; fileName: string; extension: FileFormat };

export default class BucketAdapter implements IBucketAdapter {
  private readonly s3: AWS.S3;

  private readonly bucketName: string;

  private static readonly contentTypeMap: Record<FileFormat, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
  };

  constructor(s3: AWS.S3, bucketName: string) {
    this.s3 = s3;
    this.bucketName = bucketName;
  }

  async upload({ data, fileName, extension }: UploadParams): Promise<string> {
    logger.info(`Uploading ${fileName} to S3 bucket`);

    const params: PutObjectRequest = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: Buffer.isBuffer(data) ? data : JSON.stringify(data),
      ContentType: extension,
      ACL: ACL_OPTIONS.PUBLIC_READ,
    };

    const response = await this.s3.upload(params).promise();

    logger.info(`Successfully uploaded ${fileName}.${extension} to S3 bucket ${this.bucketName}`);

    return response.Location;
  }

  public async get(fileName: string) {
    logger.info('attempting to get file from s3 bucket');

    const Bucket = this.bucketName;

    const params = {
      Bucket,
      Key: fileName,
    };

    let data = null;

    try {
      logger.info('attempting getObject', {
        data,
      });

      data = await this.s3.getObject(params).promise();

      logger.info('success got file from s3 bucket');
    } catch (error) {
      logger.error('getObject error', { error });
      throw error;
    }

    if (!data) {
      logger.error(`Failed to get file ${fileName}, from ${Bucket}`);
      throw Error(`Failed to get file ${fileName}, from ${Bucket}`);
    }

    if (/\.json$/.test(fileName)) {
      logger.info('parsing object to json');
      data = JSON.parse(String(data?.Body?.toString()));
    }

    return data;
  }

  /**
   * Fetches all objects which filename starts with the given prefix and the content type matches the given extension.
   * Returns an array of data urls encoded in base64.
   * @param prefix
   * @param extension
   */
  async getObjectsByPrefixAndContentType(prefix: string, extension: FileFormat): Promise<string[]> {
    logger.info(`Fetching list of objects with prefix '${prefix}' from S3 bucket`);

    const response: ListObjectsV2Output = await this.s3
      .listObjectsV2({
        Bucket: this.bucketName,
        Prefix: prefix,
      })
      .promise();

    const list = response.Contents || [];

    logger.info(
      `Successfully fetched list of objects with prefix '${prefix}' from S3 bucket: ${list.length} objects found`
    );

    if (!list.length) {
      return [];
    }

    logger.info('Fetching objects contents from S3 bucket');

    const objects = await Promise.all(
      list.map((entry: Record<string, any>) =>
        this.s3
          .getObject({
            Bucket: this.bucketName,
            Key: entry.Key as string,
          })
          .promise()
      )
    );

    logger.info('Successfully fetched objects contents from S3 bucket');

    const contentType = BucketAdapter.contentTypeMap[extension];

    return objects
      .filter(({ ContentType }: GetObjectOutput) => ContentType === contentType)
      .reduce((result: string[], object: GetObjectOutput) => {
        if (!object.Body) {
          return result;
        }

        return [...result, Buffer.from(object.Body).toString('base64')];
      }, []);
  }

  async uploadAll(params: UploadParams[]) {
    logger.info('S3Client.save request', {
      request: redactCustomerDetails(params),
    });

    const { results } = await PromisePool.withConcurrency(1)
      .for(params)
      .handleError(async (error) => {
        throw error; // Uncaught errors will immediately stop PromisePool
      })
      .process(async (params) => this.upload(params));

    return results;
  }

  public async batchUpload(params: UploadParams[], chunkSize = 25) {
    logger.info('S3Client.batchWrite request', {
      request: redactCustomerDetails(params),
    });

    const chunkedParams = chunk(params, chunkSize);

    logger.info('S3Client.batchWrite chunkedparams request', {
      request: redactCustomerDetails(chunkedParams),
    });

    const { results } = await PromisePool.withConcurrency(100)
      .for(chunkedParams)
      .handleError(async (error) => {
        throw error; // Uncaught errors will immediately stop PromisePool
      })
      .process((entries) => {
        return this.uploadAll(entries);
      });

    return flatten(results);
  }
}

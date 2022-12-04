import PromisePool from '@supercharge/promise-pool/dist';
import AWS from 'aws-sdk';

import AWSMock = require('mock-aws-s3');
import crypto = require('crypto');

import * as fileType from 'file-type';

import { IS_TEST_MODE } from './test-mode';
import { chunk, flatten } from 'lodash';
import logger from '/opt/logger';
import { redactCustomerDetails } from '/opt/RedactCustomerDetails';
import core = require('file-type/core');

export const s3Path = IS_TEST_MODE
  ? '/tmp/buckets/'
  : `https://${process.env.bucketName}.s3-${
      process.env?.region || process.env.AWS_REGION
    }.amazonaws.com/`;

export enum ACL_OPTIONS {
  PUBLIC_READ = 'public-read',
}

AWSMock.config.basePath = s3Path; // Can configure a basePath for your local buckets

const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];

export interface S3WRITE {
  Body: Buffer;
  Bucket: string;
  Key: string;
  ACL: string;
  ContentType: string | core.MimeType;
}

export type BATCHWRITE = Record<string, any>;

export interface IParse {
  type: string;
  Body?: Buffer;
  filename: string;
  contentType: string;
  content: Buffer;
}

export class S3Client {
  s3Client: AWS.S3;

  constructor() {
    this.s3Client = this.createS3Client();
  }

  private createS3Client(isLocal = false): AWS.S3 {
    return isLocal || IS_TEST_MODE ? new AWSMock.S3({}) : new AWS.S3({});
  }

  public async get({ Key, Bucket }: AWS.S3.Types.GetObjectRequest) {
    logger.info('attempting to get file from s3 bucket');

    const params = {
      Bucket,
      Key,
    };

    let data = null;

    try {
      logger.info('attempting getObject', {
        data,
      });
      data = await this.s3Client.getObject(params).promise();
      logger.info('success got file from s3 bucket');
    } catch (error) {
      logger.error('getObject error', { error });
      throw error;
    }

    if (!data) {
      logger.error(`Failed to get file ${Key}, from ${Bucket}`);
      throw Error(`Failed to get file ${Key}, from ${Bucket}`);
    }

    if (/\.json$/.test(Key)) {
      logger.info('parsing object to json');
      data = JSON.parse(String(data?.Body?.toString()));
    }

    return data;
  }

  async write({ Body, Bucket, Key, ACL, ContentType }: S3WRITE) {
    const params = {
      Bucket,
      Body: Buffer.isBuffer(Body) ? Body : JSON.stringify(Body),
      Key,
      ACL,
      ContentType,
    };

    const newData = await this.s3Client.upload(params).promise();

    if (!newData) {
      throw Error('there was an error writing the file');
    }

    return newData;
  }

  async save(params: BATCHWRITE[]) {
    logger.info('S3Client.save request', {
      request: redactCustomerDetails(params),
    });

    const { results } = await PromisePool.withConcurrency(1)
      .for(params)
      .handleError(async (error) => {
        throw error; // Uncaught errors will immediately stop PromisePool
      })
      .process(async (imageBody) => {
        if (!imageBody.image || !imageBody.mime) {
          throw new Error();
        }

        if (!allowedMimes.includes(imageBody.mime)) {
          throw new Error();
        }

        let image = imageBody.image;

        if (imageBody.image.substr(0, 7) === 'base64,') {
          image = imageBody.image.substr(7, imageBody.image.length);
        }

        const Bucket = process.env?.bucketName || 'test';

        const imageBuffer = Buffer.from(image, 'base64');

        const fileInfo = await fileType.fromBuffer(imageBuffer);
        const detectedExt = fileInfo?.ext;
        const detectedMime = fileInfo?.mime;

        const hashedFile = crypto
          .createHash('md5')
          .update(new Uint8Array(imageBuffer))
          .digest('hex');

        const Key = `upload/${hashedFile}.${detectedExt}`;

        console.log(`writing image to bucket called ${Key}`);

        logger.info('before S3Client.write request', {
          request: {
            Bucket,
            Key,
            imageBuffer,
            hashedFile,
          },
        });

        await this.write({
          Bucket,
          Body: imageBuffer,
          Key,
          ContentType: String(detectedMime),
          ACL: ACL_OPTIONS.PUBLIC_READ,
        });

        return {
          imageURL: `${s3Path}${IS_TEST_MODE ? Bucket + '/' : ''}${Key}`,
          Key,
          Bucket,
          hashedFile,
        };
      });

    return results;
  }

  public async batchWrite(params: BATCHWRITE | BATCHWRITE[], chunkSize = 25) {
    logger.info('S3Client.batchWrite request', {
      request: redactCustomerDetails(params),
    });

    const args = !Array.isArray(params) ? [params] : params;

    const chunkedParams = chunk(args, chunkSize);

    logger.info('S3Client.batchWrite chunkedparams request', {
      request: redactCustomerDetails(chunkedParams),
    });

    const { results } = await PromisePool.withConcurrency(100)
      .for(chunkedParams)
      .handleError(async (error) => {
        throw error; // Uncaught errors will immediately stop PromisePool
      })
      .process((entries) => {
        return this.save(entries);
      });

    return flatten(results);
  }

  public async getSignedURL({ Bucket, Key, Expires, mimetype }: any) {
    const url = await this.s3Client
      .getSignedUrl('getObject', {
        Bucket,
        Key,
        Expires,
      })
      .split('?')[0];

    return { url, mimetype: mimetype && mimetype.split('/')[1] };
  }
}

const S3 = new S3Client();
export default S3;

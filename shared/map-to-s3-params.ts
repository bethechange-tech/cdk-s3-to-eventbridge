import PromisePool from '@supercharge/promise-pool/dist';
import crypto from 'crypto';

import * as fileType from 'file-type';
import AppError from './appError';
import { HTTP_STATUS_CODE } from './HTTP_STATUS_CODE';

import logger from './logger';
import { FileFormat } from '/opt/adapters/BucketAdapter/BucketAdapter';

export type ImageBody = { image: string; mime: string };

const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];

export async function mapToS3Params(imageBody: ImageBody | ImageBody[]) {
  const args = !Array.isArray(imageBody) ? [imageBody] : imageBody;

  const { results } = await PromisePool.withConcurrency(1)
    .for(args)
    .handleError(async (error) => {
      throw error; // Uncaught errors will immediately stop PromisePool
    })
    .process(async (imageBody) => {
      if (!imageBody.image || !imageBody.mime) {
        throw new AppError('', HTTP_STATUS_CODE.BAD_REQUEST);
      }

      if (!allowedMimes.includes(imageBody.mime)) {
        throw new AppError('', HTTP_STATUS_CODE.BAD_REQUEST);
      }

      let image = imageBody.image;

      if (imageBody.image.substr(0, 7) === 'base64,') {
        image = imageBody.image.substr(7, imageBody.image.length);
      }

      const imageBuffer = Buffer.from(image, 'base64');
      const fileInfo = await fileType.fromBuffer(imageBuffer);
      const detectedExt = fileInfo?.ext;
      const detectedMime = fileInfo?.mime;

      const hashedFile = crypto.createHash('md5').update(new Uint8Array(imageBuffer)).digest('hex');

      const Key = `upload/${hashedFile}.${detectedExt}`;

      logger.info(`writing image to bucket called ${Key}`);

      logger.info('before S3Client.write request', {
        request: {
          Key,
          imageBuffer,
          hashedFile,
        },
      });

      return { data: imageBuffer, fileName: Key, extension: String(detectedMime) as FileFormat };
    });

  return results;
}

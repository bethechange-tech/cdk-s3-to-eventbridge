import { APIGatewayProxyEvent } from 'aws-lambda';
import jimp from 'jimp';
import crypto from 'crypto';
import logger from '../logger';
import { ACL_OPTIONS, IParse } from '../s3-client';
import { storageBucketAdapter } from '../adapters/BucketAdapter/IBucketAdapter';
import BucketAdapter, { FileFormat } from '../adapters/BucketAdapter/BucketAdapter';
import Jimp from 'jimp';

export enum FilesFormat {
  PDF = 'pdf',
  PNG = 'png',
}

export class FileUpload {
  private s3Client: BucketAdapter;

  constructor(bucketAdapter: BucketAdapter) {
    this.s3Client = bucketAdapter;
  }

  private static getBoundary(headers: APIGatewayProxyEvent['headers']) {
    return FileUpload.getValueIgnoringKeyCase(headers, 'Content-Type')?.split('=')[1];
  }

  private static getValueIgnoringKeyCase(object: Record<string, any>, key: string) {
    const foundKey = String(
      Object.keys(object).find((currentKey) => currentKey.toLocaleLowerCase() === key.toLowerCase())
    );

    return object[foundKey];
  }

  public async hashFile({
    jimpImage,
    width,
    height,
    mime,
  }: {
    jimpImage: Jimp;
    width: number;
    height: number;
    mime: string;
  }) {
    const resizedImageBase64 = await jimpImage
      .scaleToFit(width, height)
      .quality(90)
      .getBase64Async(mime);

    logger.info('image to buffer complete ...');

    return crypto.createHash('md5').update(resizedImageBase64).digest('hex');
  }

  public resizeImage = async ({
    Bucket,
    Key,
    width,
    height,
  }: {
    Bucket: string;
    Key: string;
    width: number;
    height: number;
  }) => {
    logger.info('image resize begins...');

    const imageBuffer = await this.s3Client.get(Key);
    logger.info('successfully got image from s3');

    const jimpImage = await jimp.read(imageBuffer?.Body);

    logger.info('successfully read image', {
      jimpImage: String(jimpImage).substring(0, 20),
    });

    const mime = jimpImage.getMIME();

    logger.info('image to buffer begins ...');

    const resizedImageBuffer = await jimpImage
      .scaleToFit(width, height)
      .quality(90)
      .getBufferAsync(mime);

    logger.info('image to buffer complete ...');

    const imageExtention = mime.split('/')[1];

    const hashedFile = await this.hashFile({
      jimpImage,
      width,
      height,
      mime,
    });

    const newFileName = `resized/${width}x${height}/${hashedFile}.${imageExtention}`;

    logger.info('write resize images params', {
      request: {
        Body: String(resizedImageBuffer).substring(0, 20),
        Bucket,
        Key: newFileName,
        ACL: ACL_OPTIONS.PUBLIC_READ,
        ContentType: mime,
      },
    });

    const response = await this.s3Client.upload({
      data: resizedImageBuffer,
      fileName: newFileName,
      extension: mime as FileFormat,
    });

    logger.info('image resize complete ....', {
      response,
    });

    return newFileName;
  };

  public static parse({ headers, body }: APIGatewayProxyEvent, spotText: string) {
    const boundary = FileUpload.getBoundary(headers);
    const result: Record<string, IParse | IParse[]> = {};

    body?.split(boundary).forEach((item: any) => {
      if (/filename=".+"/g.test(item)) {
        const data = {
          type: 'file',
          filename: item.match(/filename=".+"/g)[0].slice(10, -1),
          contentType: item.match(/Content-Type:\s.+/g)[0].slice(14),
          content: spotText
            ? Buffer.from(
                item.slice(
                  item.search(/Content-Type:\s.+/g) +
                    item.match(/Content-Type:\s.+/g)[0].length +
                    4,
                  -4
                ),
                'binary'
              )
            : item.slice(
                item.search(/Content-Type:\s.+/g) + item.match(/Content-Type:\s.+/g)[0].length + 4,
                -4
              ),
        };

        const dataMatch = item.match(/name=".+";/g)[0].slice(6, -2);

        if (result[dataMatch] && !Array.isArray(result[dataMatch])) {
          result[dataMatch] = [
            //@ts-ignore
            result[dataMatch],
            data,
          ];
        } else if (result[dataMatch] && Array.isArray(result[dataMatch])) {
          //@ts-ignore
          result[dataMatch].push(data);
        } else {
          result[dataMatch] = data;
        }
      } else if (/name=".+"/g.test(item)) {
        result[item.match(/name=".+"/g)[0].slice(6, -1)] = item.slice(
          item.search(/name=".+"/g) + item.match(/name=".+"/g)[0].length + 4,
          -4
        );
      }
    });

    return result;
  }
}

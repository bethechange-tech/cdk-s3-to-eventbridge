import { EventBridgeEvent } from 'aws-lambda';
import logger from '/opt/logger';
import { FileUpload } from '/opt/file-upload';

export const handler = async function (
  event: EventBridgeEvent<string, Record<string, any>>
): Promise<void> {
  const {
    bucket: { name: Bucket },
    object: { key: Key },
  } = event.detail;

  try {
    const width = 300;
    const height = 300;
    const fileUpload = new FileUpload();
    const newFileName = await fileUpload.resizeImage({ Bucket, Key, width, height });

    logger.info('upload and resized images successfully', {
      newFileName,
    });

    logger.info('successfully resized images');
  } catch (err) {
    const error = err as Record<string, any>;
    logger.error('error in try catch', error);
  }
};

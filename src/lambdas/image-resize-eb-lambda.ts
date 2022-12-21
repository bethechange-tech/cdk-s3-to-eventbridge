import { EventBridgeEvent } from 'aws-lambda';
import logger from '/opt/logger';
import { FileUpload } from '/opt/file-upload';
import { storageBucketAdapter } from '/opt/adapters/BucketAdapter/IBucketAdapter';

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

    const bucketAdapter = storageBucketAdapter();

    const fileUpload = new FileUpload(bucketAdapter);
    const newFileName = await fileUpload.resizeImage({ Bucket, Key, width, height });

    logger.info('upload and resized images successfully', {
      newFileName,
    });
  } catch (err) {
    const error = err as Error;
    logger.error('error in try catch', error);
  }
};

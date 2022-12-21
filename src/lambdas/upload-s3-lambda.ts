import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { storageBucketAdapter } from '/opt/adapters/BucketAdapter/IBucketAdapter';
import { ApiResponses } from '/opt/api-responses';
import AppError from '/opt/appError';

import { CBHandler } from '/opt/cb-handler';
import { HTTP_STATUS_CODE } from '/opt/HTTP_STATUS_CODE';

import logger from '/opt/logger';
import { ImageBody, mapToS3Params } from '/opt/map-to-s3-params';

import { redactCustomerDetails } from '/opt/RedactCustomerDetails';

export const handler = CBHandler(async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('lambda has been invoked', {
    request: redactCustomerDetails(event),
  });

  if (!event.body) throw new AppError('', HTTP_STATUS_CODE.BAD_REQUEST);

  const imageBody: ImageBody | ImageBody[] = JSON.parse(event.body);

  try {
    const params = await mapToS3Params(imageBody);
    const s3Client = storageBucketAdapter();

    const response = await s3Client.batchUpload(params);

    logger.info('store image successfuly', {
      response,
    });

    return ApiResponses._200(response);
  } catch (err) {
    logger.error('an error has occured in Image upload request', {
      error: err,
    });

    throw err;
  }
});

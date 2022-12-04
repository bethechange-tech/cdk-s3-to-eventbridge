import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '/opt/logger';

import { redactCustomerDetails } from '/opt/RedactCustomerDetails';

import S3 from '/opt/s3-client';

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('lambda has been invoked', {
    request: redactCustomerDetails(event),
  });

  if (!event.body) throw new Error();

  const imageBody: { image: string; mime: string } | { image: string; mime: string }[] = JSON.parse(
    event.body
  );

  try {
    const response = await S3.batchWrite(imageBody);

    logger.info('store image successfuly', {
      response,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (err) {
    logger.error('an error has occured in Image upload request', {
      error: err,
    });

    return {
      statusCode: 400,
      body: JSON.stringify({
        status: 'error',
        message: 'Something went very wrong!',
      }),
    };
  }
};

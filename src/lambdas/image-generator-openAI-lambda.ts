import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Configuration, CreateImageRequestSizeEnum, OpenAIApi } from 'openai';
import { ApiResponses } from '/opt/api-responses';
import AppError from '/opt/appError';
import { CBHandler } from '/opt/cb-handler';
import { HTTP_STATUS_CODE } from '/opt/HTTP_STATUS_CODE';

import logger from '/opt/logger';

import { redactCustomerDetails } from '/opt/RedactCustomerDetails';

//@TODO

/**
 * @TODO
 * REFACTOR CODE
 */

//  https://beta.openai.com/account/api-keys
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const handler = CBHandler(async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('lambda has been invoked', {
    request: redactCustomerDetails(event),
  });

  if (!event.body) throw new AppError('', HTTP_STATUS_CODE.BAD_REQUEST);

  const {
    prompt,
    size,
    limit = 5,
  } = JSON.parse(event.body) as { prompt: string; size: string; limit: number };

  const imageSize =
    size === 'small'
      ? CreateImageRequestSizeEnum._256x256
      : size === 'medium'
      ? CreateImageRequestSizeEnum._512x512
      : CreateImageRequestSizeEnum._1024x1024;

  try {
    const params = {
      prompt,
      n: limit,
      size: imageSize,
    };

    const response = await openai.createImage(params);

    const imageUrls = response.data.data.map(({ url }) => url);

    logger.info('retreived image successfully', {
      response,
    });

    return ApiResponses._200({ success: true, imageUrls });
  } catch (err) {
    const error = err as Record<string, any>;

    logger.error('an error has occured in Image upload request', {
      error: err,
    });

    let errorMessage = null;

    if (error.response) {
      logger.error(error.response.status);
      logger.error(error.response.data);
      errorMessage = error.response.data;
    } else {
      errorMessage = error?.message;
      logger.error(errorMessage);
    }

    return ApiResponses._400({
      status: 'error',
      success: false,
      message: errorMessage || 'The image could not be generated',
    });
  }
});

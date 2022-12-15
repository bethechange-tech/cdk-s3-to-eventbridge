import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Configuration, CreateImageRequestSizeEnum, OpenAIApi } from 'openai';
import { ApiResponses } from '/opt/api-responses';

import logger from '/opt/logger';

import { redactCustomerDetails } from '/opt/RedactCustomerDetails';

//@TODO

/**
 * @TODO
 * REFACTOR CODE
 */

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('lambda has been invoked', {
    request: redactCustomerDetails(event),
  });

  if (!event.body) throw new Error();

  const { prompt, size } = JSON.parse(event.body) as { prompt: string; size: string };

  const imageSize =
    size === 'small'
      ? CreateImageRequestSizeEnum._256x256
      : size === 'medium'
      ? CreateImageRequestSizeEnum._512x512
      : CreateImageRequestSizeEnum._1024x1024;

  try {
    const params = {
      prompt,
      n: 1,
      size: imageSize,
    };

    const response = await openai.createImage(params);
    const imageUrl = response.data.data[0].url;

    logger.info('retreived image successfully', {
      response,
    });

    return ApiResponses._200({ success: true, imageUrl });
  } catch (err) {
    logger.error('an error has occured in Image upload request', {
      error: err,
    });

    return ApiResponses._400({
      status: 'error',
      success: false,
      message: 'The image could not be generated',
    });
  }
};

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import AppError from './appError';
import { HTTP_STATUS_CODE } from './HTTP_STATUS_CODE';
import logger from './logger';

type AWSLambda = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult> | APIGatewayProxyResult;

export const isJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

const computeError = (message: string) => {
  const errorIsJson = isJson(message);

  return errorIsJson
    ? JSON.parse(message)
    : { body: JSON.stringify(message), statusCode: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR };
};

export const CBHandler =
  (handlerFunction: AWSLambda) =>
  async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    let response;
    logger.info(`--- function starting`);

    try {
      response = await handlerFunction(event, context);
    } catch (e) {
      const caughtError = e as AppError;
      logger.error(`WPError ${JSON.stringify(caughtError?.message)}`);
      response = computeError(caughtError.message);
    }

    return {
      statusCode: response?.statusCode || 500,
      body: response.body,
      headers: response.headers,
      multiValueHeaders: response.multiValueHeaders,
      isBase64Encoded: response.isBase64Encoded,
    };
  };

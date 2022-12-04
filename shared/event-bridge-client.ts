import {
  EventBridgeClient,
  EventBridgeClientConfig,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import logger from './logger';

export class EBClient extends EventBridgeClient {
  constructor(config: EventBridgeClientConfig) {
    super(config);
  }

  public sendEvent = async ({
    type,
    detail,
    busName,
    eventSource,
  }: {
    type: string;
    detail: Record<string, any>;
    busName: string;
    eventSource: string;
  }) => {
    const params = {
      Entries: [
        {
          Detail: JSON.stringify({ payload: detail }),
          DetailType: type,
          EventBusName: busName,
          Source: eventSource,
        },
      ],
    };

    logger.info('push event to event-bridge', {
      request: params,
    });

    return this.send(new PutEventsCommand(params));
  };
}

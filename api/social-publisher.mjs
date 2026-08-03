import { loadPublisherConfig } from '../server/social-publisher/config.mjs';
import { createPublisherHandler } from '../server/social-publisher/handler.mjs';
import { ProviderTransport } from '../server/social-publisher/providers.mjs';
import { PublisherRepository } from '../server/social-publisher/repository.mjs';
import { PublisherService } from '../server/social-publisher/service.mjs';

let handlerPromise;

async function runtimeHandler() {
  if (!handlerPromise) {
    handlerPromise = Promise.resolve().then(() => {
      const config = loadPublisherConfig();
      const repository = PublisherRepository.fromConnectionString(config.databaseUrl);
      const transport = new ProviderTransport();
      const service = new PublisherService({ config, repository, transport });
      return createPublisherHandler({ service, config });
    });
  }
  return handlerPromise;
}

export const config = { maxDuration: 60 };

export default {
  async fetch(request) {
    const handler = await runtimeHandler();
    return handler(request);
  },
};

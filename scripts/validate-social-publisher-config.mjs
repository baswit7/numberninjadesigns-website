import { loadPublisherConfig, publicConfig } from '../server/social-publisher/config.mjs';

const config = loadPublisherConfig();
console.log(JSON.stringify({ ok: true, ...publicConfig(config), secretValuesEmitted: false }));

declare const Bun: any;

import { loadConfig, startWatcher, Config } from './config';
import { 
  listModels, 
  tagsHandler, 
  showHandler, 
  healthCheck, 
  setDebugFlag 
} from './handlers';
import { proxyHandler } from './proxy';

let config: Config;

function createRequestHandler(config: Config) {
  return async (req: Request) => {
    const url = new URL(req.url);
    
    if (url.pathname === '/') return healthCheck();
    if (url.pathname === '/v1/models') return listModels(config);
    if (url.pathname === '/api/tags') return tagsHandler(config);
    if (url.pathname === '/api/show' && req.method === 'POST') return showHandler(config, req);
    if (url.pathname.startsWith('/v1/chat/')) return proxyHandler(config, req);
    
    return new Response('Not Found', { status: 404 });
  };
}

async function startServer(config: Config) {
  const { server: serverConfig } = config;
  let currentPort = serverConfig.port;
  let server = null;
  let attempts = 0;
  
  while (attempts <= serverConfig.maxPortAttempts) {
    try {
      server = Bun.serve({
        port: currentPort,
        hostname: serverConfig.hostname,
        fetch: createRequestHandler(config)
      });
      
      console.log(`Server started at http://${server.hostname}:${server.port}`);
      return server;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE' && attempts < serverConfig.maxPortAttempts) {
        attempts++;
        currentPort++;
        console.log(`Port ${currentPort - 1} is in use, trying port ${currentPort}...`);
      } else {
        console.error(`Failed to start server: ${error.message}`);
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to start server after ${serverConfig.maxPortAttempts} attempts`);
}

function reloadConfig() {
  try {
    config = loadConfig();
    console.log('Config reloaded successfully');
  } catch (err) {
    console.error(`Failed to reload config: ${err}`);
  }
}

async function main() {
  // 加载配置
  config = loadConfig();
  
  // 设置调试标志
  setDebugFlag(process.env.DEBUG === 'true');
  
  // 启动服务器
  const server = await startServer(config);
  
  // 启动配置监听器
  startWatcher(reloadConfig);
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
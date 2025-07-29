import { readFileSync, watch, existsSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

export interface ProviderConfig {
  name: string;
  provider?: string;
  baseUrl?: string;
  model: string;
  apiKey: string;
  systemMessage?: string;
  modelfile?: string;
  parameters?: string;
  template?: string;
}

export interface ServerConfig {
  port: number;
  hostname: string;
  maxPortAttempts: number;
}

export interface Config {
  server: ServerConfig;
  models: ProviderConfig[];
}

const configPath = process.env.CONFIG_PATH || 'config.yaml';
let config: Config = {
  server: {
    port: 11434,
    hostname: '127.0.0.1',
    maxPortAttempts: 20
  },
  models: []
};

function createDefaultConfig(): Config {
  const defaultConfig: Config = {
    server: {
      port: 11434,
      hostname: '127.0.0.1',
      maxPortAttempts: 20
    },
    models: [
      {
        name: "example-model",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: "your_api_key_here",
        systemMessage: "You are a helpful assistant."
      }
    ]
  };
  
  try {
    writeFileSync(configPath, stringify(defaultConfig));
    console.log(`Created default config file at ${configPath}`);
    return defaultConfig;
  } catch (err) {
    console.error(`Failed to create default config: ${err}`);
    return config;
  }
}

export function loadConfig(): Config {
  try {
    // 检查配置文件是否存在
    if (!existsSync(configPath)) {
      console.log(`Config file not found at ${configPath}, creating default config...`);
      config = createDefaultConfig();
      return config;
    }
    
    const data = readFileSync(configPath, 'utf8');
    config = parse(data) as Config;
    
    // 确保服务器配置存在
    if (!config.server) {
      config.server = {
        port: 11434,
        hostname: '127.0.0.1',
        maxPortAttempts: 20
      };
    }
    
    console.log('Config reloaded successfully');
    return config;
  } catch (err) {
    console.error(`Failed to load config: ${err}`);
    process.exit(1);
  }
}

export function startWatcher(callback: () => void): void {
  try {
    watch(configPath, (eventType) => {
      if (eventType === 'change') {
        callback();
      }
    });
    console.log('Config watcher started');
  } catch (err) {
    console.error(`Failed to start config watcher: ${err}`);
  }
}
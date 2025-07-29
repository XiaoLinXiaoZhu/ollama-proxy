declare const Bun: any;

import { readFileSync, watch, existsSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

interface OllamaTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaTag[];
}

interface ProviderConfig {
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

interface Config {
  models: ProviderConfig[];
}

const configPath = process.env.CONFIG_PATH || 'config.yaml';
let config: Config = { models: [] };
let debugFlag = process.env.DEBUG === 'true';

function createDefaultConfig() {
  const defaultConfig: Config = {
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
    if (debugFlag) {
      console.error((err as Error).stack);
    }
    return { models: [] };
  }
}

function loadConfig() {
  try {
    // 检查配置文件是否存在
    if (!existsSync(configPath)) {
      console.log(`Config file not found at ${configPath}, creating default config...`);
      config = createDefaultConfig();
      return;
    }
    
    const data = readFileSync(configPath, 'utf8');
    config = parse(data) as Config;
    console.log('Config reloaded successfully');
  } catch (err) {
    console.error(`Failed to load config: ${err}`);
    if (debugFlag) {
      console.error((err as Error).stack);
    }
    process.exit(1);
  }
}

function startWatcher() {
  try {
    watch(configPath, (eventType) => {
      if (eventType === 'change') {
        loadConfig();
      }
    });
    console.log('Config watcher started');
  } catch (err) {
    console.error(`Failed to start config watcher: ${err}`);
    if (debugFlag) {
      console.error((err as Error).stack);
    }
  }
}

function logRequest(req: Request, bodyText: string) {
  if (!debugFlag) return;
  
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  console.log(`[DEBUG] Incoming Request:
Method: ${req.method}
URL: ${req.url}
Headers: ${JSON.stringify(headers, null, 2)}
Body: ${bodyText}`);
}

function logResponse(response: Response, responseBody: string) {
  if (!debugFlag) return;
  
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  console.log(`[DEBUG] Response:
Status: ${response.status}
Headers: ${JSON.stringify(headers, null, 2)}
Body: ${responseBody}`);
}

function listModels(req: Request) {
  const models = config.models.map(provider => ({
    id: provider.name,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'ollama-proxy'
  }));

  return new Response(JSON.stringify({
    object: 'list',
    data: models
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function tagsHandler(req: Request) {
  const now = new Date().toISOString();
  const response: OllamaTagsResponse = {
    models: config.models.map(provider => ({
      name: provider.name,
      model: provider.name,
      modified_at: now,
      size: 0,
      digest: '',
      details: {
        format: 'proxy',
        family: 'proxy',
        families: [],
        parameter_size: 'N/A',
        quantization_level: 'N/A'
      }
    }))
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function showHandler(req: Request) {
  return req.json().then(body => {
    const target = config.models.find(p => p.name === body.model);
    if (!target) {
      return new Response(JSON.stringify({ error: `model '${body.model}' not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const modelfileContent = target.modelfile || `# Modelfile for ${target.name} (proxied)\nFROM scratch`;
    const parametersContent = target.parameters || '# No specific parameters defined in proxy config';
    const templateContent = target.template || `{{ if .System }}System: {{ .System }}{{ end }}\nUser: {{ .Prompt }}\nAssistant: {{ .Response }}`;

    return new Response(JSON.stringify({
      license: "",
      modelfile: modelfileContent,
      parameters: parametersContent,
      template: templateContent,
      details: {
        parent_model: "",
        format: "proxy",
        family: "proxy",
        families: [],
        parameter_size: "N/A",
        quantization_level: "N/A"
      },
      model_info: {
        "general.architecture": "llama",
        "general.name": target.name,
        "general.file_type": 2,
        "general.parameter_count": 0,
        "llama.context_length": 120000,
        "llama.block_count": 0,
        "llama.embedding_length": 0,
        "llama.attention.head_count": 0,
        "llama.attention.head_count_kv": 0,
        "llama.attention.layer_norm_rms_epsilon": 0.00001,
        "llama.feed_forward_length": 0,
        "llama.rope.dimension_count": 0,
        "llama.rope.freq_base": 500000,
        "llama.vocab_size": 0,
        "tokenizer.ggml.model": "gpt2",
        "tokenizer.ggml.bos_token_id": 0,
        "tokenizer.ggml.eos_token_id": 0
      },
      capabilities: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }).catch(() => {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

function healthCheck(req: Request) {
  return new Response(JSON.stringify({
    status: 'running',
    message: 'Ollama Proxy is active'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function proxyHandler(req: Request) {
  // 读取请求体
  let bodyText = '';
  try {
    bodyText = await req.text();
    req = new Request(req, { body: bodyText });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  logRequest(req, bodyText);

  // 解析请求体
  let openaiReq;
  try {
    openaiReq = JSON.parse(bodyText);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 查找匹配的配置
  const target = config.models.find(p => p.name === openaiReq.model);
  if (!target) {
    return new Response(JSON.stringify({ error: `model '${openaiReq.model}' not found` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 构建目标URL - 优先使用 baseUrl，如果没有则使用 provider 映射
  let apiBase = target.baseUrl;
  if (!apiBase) {
    const providerMap: Record<string, string> = {
      'novita': 'https://api.novita.ai/v3/openai',
      'siliconflow': 'https://api.siliconflow.cn/v1',
      'groq': 'https://api.siliconflow.cn/v1',
      'xAI': 'https://api.x.ai/v1',
      'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai'
    };
    apiBase = providerMap[target.provider || ''];
    if (!apiBase) {
      return new Response(JSON.stringify({ error: 'Invalid provider configuration - please specify baseUrl or a valid provider name' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 修改请求体
  const modifiedBody = {
    ...openaiReq,
    model: target.model
  };

  // 添加系统消息（如果配置）
  if (target.systemMessage && Array.isArray(modifiedBody.messages)) {
    const hasSystem = modifiedBody.messages.some((m: any) => m.role === 'system');
    if (!hasSystem) {
      modifiedBody.messages.unshift({
        role: 'system',
        content: target.systemMessage
      });
    }
  }

  // 复制请求头
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  headersObj['Authorization'] = `Bearer ${target.apiKey}`;
  headersObj['Content-Type'] = 'application/json';

  // 发送代理请求
  try {
    // 使用 Node.js 的 https 模块来处理 TLS 证书问题
    const https = await import('https');
    const url = new URL(`${apiBase}/chat/completions`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers: headersObj,
      // 禁用 TLS 验证
      rejectUnauthorized: false
    };

    return new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        
        proxyRes.on('data', (chunk) => {
          data += chunk;
        });
        
        proxyRes.on('end', () => {
          // 复制响应头
          const responseHeaders: Record<string, string> = {};
          Object.entries(proxyRes.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              responseHeaders[key] = value.join(', ');
            } else {
              responseHeaders[key] = value || '';
            }
          });
          
          // 记录响应
          logResponse(new Response(data, {
            status: proxyRes.statusCode,
            headers: responseHeaders
          }), data);
          
          resolve(new Response(data, {
            status: proxyRes.statusCode,
            statusText: proxyRes.statusMessage,
            headers: responseHeaders
          }));
        });
      });
      
      proxyReq.on('error', (error) => {
        console.error('Proxy error:', error);
        if (debugFlag) {
          console.error(error.stack);
        }
        
        let status = 502;
        const errorMessage = error.message;
        
        if (errorMessage.includes('timeout')) {
          status = 504;
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
          status = 503;
        }
        
        resolve(new Response(JSON.stringify({ 
          error: 'Proxy error', 
          details: errorMessage,
          status
        }), {
          status,
          headers: { 'Content-Type': 'application/json' }
        }));
      });
      
      proxyReq.write(JSON.stringify(modifiedBody));
      proxyReq.end();
    });
  } catch (error) {
    console.error('Proxy error:', error);
    if (debugFlag) {
      console.error((error as Error).stack);
    }
    
    let status = 502;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('timeout')) {
      status = 504;
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      status = 503;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      details: errorMessage,
      status
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

const server = Bun.serve({
  port: 11434,
  hostname: '127.0.0.1',
  fetch(req: Request) {
    const url = new URL(req.url);
    
    if (url.pathname === '/') return healthCheck(req);
    if (url.pathname === '/v1/models') return listModels(req);
    if (url.pathname === '/api/tags') return tagsHandler(req);
    if (url.pathname === '/api/show' && req.method === 'POST') return showHandler(req);
    if (url.pathname.startsWith('/v1/chat/')) return proxyHandler(req);
    
    return new Response('Not Found', { status: 404 });
  }
});

console.log(`Server started at http://${server.hostname}:${server.port}`);

loadConfig();
startWatcher();
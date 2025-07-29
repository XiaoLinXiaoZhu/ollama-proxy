import { Config, ProviderConfig } from './config';
import { logRequest, logResponse } from './handlers';

export async function proxyHandler(config: Config, req: Request): Promise<Response> {
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
        if (process.env.DEBUG === 'true') {
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
    if (process.env.DEBUG === 'true') {
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
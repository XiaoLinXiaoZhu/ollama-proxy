import { Config, ProviderConfig } from './config';

export interface OllamaTag {
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

export interface OllamaTagsResponse {
  models: OllamaTag[];
}

let debugFlag = process.env.DEBUG === 'true';

export function setDebugFlag(flag: boolean): void {
  debugFlag = flag;
}

export function logRequest(req: Request, bodyText: string): void {
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

export function logResponse(response: Response, responseBody: string): void {
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

export function listModels(config: Config): Response {
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

export function tagsHandler(config: Config): Response {
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

export function showHandler(config: Config, req: Request): Promise<Response> {
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

export function healthCheck(): Response {
  return new Response(JSON.stringify({
    status: 'running',
    message: 'Ollama Proxy is active'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
#!/usr/bin/env node

// 测试脚本用于验证 Ollama Proxy 服务器是否正常工作

const BASE_URL = 'http://127.0.0.1:11434';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`\nTesting ${method} ${url}`);
    if (body) {
      console.log(`Request body: ${JSON.stringify(body, null, 2)}`);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${JSON.stringify(data, null, 2)}`);

    return { success: true, status: response.status, data };
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Starting Ollama Proxy tests...\n');

  // 测试健康检查
  console.log('=== Testing Health Check ===');
  await testEndpoint('/');

  // 测试模型列表
  console.log('\n=== Testing Models List ===');
  await testEndpoint('/v1/models');

  // 测试 Ollama 标签
  console.log('\n=== Testing Ollama Tags ===');
  await testEndpoint('/api/tags');

  // 测试聊天完成（需要配置有效的模型）
  console.log('\n=== Testing Chat Completion ===');
  const chatBody = {
    model: 'zai-org/GLM-4.5', // 使用配置文件中的模型名称
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    max_tokens: 50,
    temperature: 0.7
  };
  await testEndpoint('/v1/chat/completions', 'POST', chatBody);

  // 测试模型详情
  console.log('\n=== Testing Model Show ===');
  const showBody = {
    model: 'zai-org/GLM-4.5'
  };
  await testEndpoint('/api/show', 'POST', showBody);

  console.log('\n=== Tests Completed ===');
}

// 运行测试
runTests().catch(console.error);
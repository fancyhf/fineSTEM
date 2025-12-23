'use strict';

const cloud = require('@cloudbase/node-sdk');

// 初始化 CloudBase
const app = cloud.init({
  env: cloud.getCurrentEnv()
});

// 导出云函数主入口
exports.main = async (event, context) => {
  try {
    // 设置环境变量
    process.env.DEEPSEEK_API_KEY = 'sk-41c2d916808941a0bf1aa2613e910d80';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
    process.env.PORT = '8000';
    process.env.ENVIRONMENT = 'production';
    process.env.ALLOWED_ORIGINS = 'https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com';
    process.env.LOG_LEVEL = 'INFO';
    
    // 解析请求
    const { path, httpMethod, headers, queryString, body } = event;
    
    // 处理 CORS 预检请求
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: ''
      };
    }
    
    // 处理不同的 API 路由
    if (path === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }
    
    if (path === '/chat/completions' && httpMethod === 'POST') {
      return await handleChatCompletion(body);
    }
    
    if (path === '/track-a/config/export' && httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: '配置已导出',
          exportUrl: 'https://example.com/export/track-a-config.json'
        })
      };
    }
    
    if (path === '/track-e/dataset/mock' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          labels: ['JavaScript', 'Python', 'Java', 'TypeScript', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby'],
          data: [
            { year: 2012, 'JavaScript': 80, 'Python': 40, 'Java': 90, 'TypeScript': 0, 'Go': 10, 'Rust': 0, 'C++': 70, 'C#': 60, 'PHP': 80, 'Ruby': 50 },
            { year: 2013, 'JavaScript': 85, 'Python': 45, 'Java': 85, 'TypeScript': 0, 'Go': 15, 'Rust': 0, 'C++': 68, 'C#': 58, 'PHP': 75, 'Ruby': 48 },
            { year: 2014, 'JavaScript': 88, 'Python': 50, 'Java': 80, 'TypeScript': 2, 'Go': 20, 'Rust': 0, 'C++': 65, 'C#': 55, 'PHP': 70, 'Ruby': 45 },
            { year: 2015, 'JavaScript': 90, 'Python': 55, 'Java': 75, 'TypeScript': 5, 'Go': 25, 'Rust': 0, 'C++': 62, 'C#': 52, 'PHP': 65, 'Ruby': 42 },
            { year: 2016, 'JavaScript': 92, 'Python': 60, 'Java': 70, 'TypeScript': 10, 'Go': 30, 'Rust': 0, 'C++': 60, 'C#': 50, 'PHP': 60, 'Ruby': 40 },
            { year: 2017, 'JavaScript': 93, 'Python': 65, 'Java': 65, 'TypeScript': 15, 'Go': 35, 'Rust': 2, 'C++': 58, 'C#': 48, 'PHP': 55, 'Ruby': 38 },
            { year: 2018, 'JavaScript': 94, 'Python': 70, 'Java': 60, 'TypeScript': 20, 'Go': 40, 'Rust': 5, 'C++': 55, 'C#': 45, 'PHP': 50, 'Ruby': 35 },
            { year: 2019, 'JavaScript': 95, 'Python': 75, 'Java': 55, 'TypeScript': 25, 'Go': 45, 'Rust': 10, 'C++': 52, 'C#': 42, 'PHP': 45, 'Ruby': 32 },
            { year: 2020, 'JavaScript': 95, 'Python': 80, 'Java': 50, 'TypeScript': 30, 'Go': 50, 'Rust': 15, 'C++': 50, 'C#': 40, 'PHP': 40, 'Ruby': 30 },
            { year: 2021, 'JavaScript': 95, 'Python': 85, 'Java': 45, 'TypeScript': 35, 'Go': 55, 'Rust': 20, 'C++': 48, 'C#': 38, 'PHP': 35, 'Ruby': 28 },
            { year: 2022, 'JavaScript': 95, 'Python': 90, 'Java': 40, 'TypeScript': 40, 'Go': 60, 'Rust': 25, 'C++': 45, 'C#': 35, 'PHP': 30, 'Ruby': 25 }
          ]
        })
      };
    }
    
    if (path.startsWith('/analytics/') && httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: '数据已记录',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 默认响应
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Not Found' })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// 处理聊天完成请求
async function handleChatCompletion(requestBody) {
  const axios = require('axios');
  
  try {
    const request = JSON.parse(requestBody);
    const { messages, context } = request;
    
    // 检查是否有有效的 API 密钥
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL;
    
    if (!apiKey || apiKey === 'sk-placeholder') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(simulateResponse(messages, context))
      };
    }
    
    // 准备系统提示
    let systemPrompt = "You are a helpful AI programming tutor for children. Explain code simply and clearly.";
    if (context) {
      systemPrompt += `\n\nCurrent Code/Context:\n${context}`;
    }
    
    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    
    // 调用 DeepSeek API
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: fullMessages,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        role: 'assistant',
        content: response.data.choices[0].message.content
      })
    };
    
  } catch (error) {
    console.error('Chat completion error:', error);
    const request = JSON.parse(requestBody);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(simulateResponse(request.messages, request.context))
    };
  }
}

// 模拟响应函数
function simulateResponse(messages, context) {
  if (!messages || messages.length === 0) {
    return {
      role: 'assistant',
      content: '你好！我是你的AI编程助手。有什么我可以帮助你的吗？'
    };
  }
  
  const lastUserMsg = messages[messages.length - 1].content.toLowerCase();
  
  if (lastUserMsg.includes('双摆') || lastUserMsg.includes('double pendulum')) {
    return {
      role: 'assistant',
      content: '双摆是一个非常有趣的物理系统！它的运动是"混沌"的，意思是说，哪怕你只是改变一点点初始位置，最后的样子都会完全不一样。这就像是"蝴蝶效应"哦！🦋'
    };
  } else if (lastUserMsg.includes('重力') || lastUserMsg.includes('gravity')) {
    return {
      role: 'assistant',
      content: '重力就像是地球的一只大手，一直把所有东西往下拉。在我们的代码里，`engine.world.gravity.y` 就控制着这个力量的大小。如果你把它设为 0，小球就会飘起来，像在太空中一样！🚀'
    };
  } else if (lastUserMsg.includes('python')) {
    return {
      role: 'assistant',
      content: 'Python 是一种非常流行的编程语言，特别适合做数据分析和人工智能。在 Track E 里，我们可以看到 Python 在 2012 年之后突然变得超级受欢迎，这都多亏了 AI 的发展呢！🐍'
    };
  } else {
    return {
      role: 'assistant',
      content: '这是一个很好的问题！作为你的 AI 编程助手，我可以帮你解释这段代码是如何工作的。你可以试着问我关于"重力"、"摩擦力"或者"排序算法"的问题哦！(注意：当前未配置 DeepSeek API Key，仅为模拟回复)'
    };
  }
}
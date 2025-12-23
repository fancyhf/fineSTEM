const http = require('http');

// FastAPI兼容处理器
const FastApiCompatibleHandler = async (event, context) => {
    // 解析请求
    const method = event.httpMethod || event.requestMethod;
    const path = event.path || event.pathInfo;
    const headers = event.headers || {};
    const queryString = event.queryString || event.queryParameters || {};
    const body = event.body || '';

    // 构建请求选项
    let requestOptions = {
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
    };

    // 处理不同的端点
    if (path === '/chat/completions' || path.includes('/chat')) {
        try {
            // 解析请求体
            let requestBody;
            try {
                requestBody = JSON.parse(body);
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    },
                    body: JSON.stringify({ error: 'Invalid JSON in request body' })
                };
            }

            // 构建DeepSeek API请求
            const deepseekRequest = {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a helpful AI programming tutor for children. Explain code simply and clearly." },
                    ...requestBody.messages
                ],
                stream: false
            };

            // 发送请求到DeepSeek
            const response = await makeHttpRequest(requestOptions, JSON.stringify(deepseekRequest));
            
            // 解析响应
            let responseData;
            try {
                responseData = JSON.parse(response.data);
            } catch (e) {
                responseData = { error: 'Failed to parse API response' };
            }

            // 返回响应
            return {
                statusCode: response.statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    role: "assistant",
                    content: responseData.choices && responseData.choices[0] ? responseData.choices[0].message.content : "抱歉，AI服务暂时不可用。请稍后再试。"
                })
            };
        } catch (error) {
            console.error('Chat completion error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    role: "assistant",
                    content: "抱歉，连接服务器失败。请检查后端服务是否启动，或者 API Key 是否配置正确。"
                })
            };
        }
    } else if (path === '/health') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({ status: "OK" })
        };
    } else if (path === '/track-a') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                title: "Track A: 物理反直觉",
                description: "基于 Matter.js 的双摆混沌模拟。探索初始条件微小变化带来的蝴蝶效应。",
                status: "active",
                features: ["双摆物理模拟", "混沌系统演示", "交互式控制面板"]
            })
        };
    } else if (path === '/track-e') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                title: "Track E: 数据可视化",
                description: "Code Never Sleeps. 可视化编程语言流行度演变，洞察技术趋势。",
                status: "active",
                features: ["编程语言流行度图表", "时间轴动画", "交互式数据探索"]
            })
        };
    } else if (path === '/analytics') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                title: "学习分析",
                description: "跟踪和分析学习进度",
                status: "active",
                features: ["学习进度统计", "知识点掌握度分析", "个性化推荐"]
            })
        };
    }

    // 默认响应
    return {
        statusCode: 404,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({ error: 'Endpoint not found' })
    };
};

// 发送HTTP请求的辅助函数
const makeHttpRequest = (options, data) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    data: responseData
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
};

module.exports = { FastApiCompatibleHandler };
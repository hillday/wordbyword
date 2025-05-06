// api/index.js
import { v4 as uuidv4 } from 'uuid';

// 创建一个简单的内存存储来跟踪会话
const sessions = {};

// 环境变量中应该保存您的API密钥
const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = process.env.API_URL || 'https://api.openai.com/v1/chat/completions';
const API_MODEL = process.env.API_MODEL || 'gpt-3.5-turbo';

const translations = {
  'zh': {
    'startingPrompt': '让我们一起创作一个故事，AI开始提供前三个字，然后你我轮流添加一个字，直到形成一个完整的句子。',
    'initialPrompt': '请开始一个故事，只提供前三个字，不要提供标点符号',
    'nextCharPrompt': '继续这个故事，只提供下一个字，考虑上下文，使句子通顺。当前文本: '
  },
  'en': {
    'startingPrompt': 'Let\'s create a story together. AI will start with the first three characters, then we\'ll take turns adding one character at a time until we form a complete sentence.',
    'initialPrompt': 'Start a story by providing only the first three characters, no punctuation',
    'nextCharPrompt': 'Continue this story by providing only the next character, considering the context to make the sentence flow naturally. Current text: '
  },
  'ja': {
    'startingPrompt': '一緒に物語を作りましょう。AIが最初の3文字を提供し、その後は交互に1文字ずつ追加して、文を完成させます。',
    'initialPrompt': '物語を始めるために、最初の3文字だけを提供してください。句読点はなし',
    'nextCharPrompt': '文脈を考慮して、文が自然に流れるように次の1文字だけを提供して物語を続けてください。現在のテキスト: '
  },
  'ko': {
    'startingPrompt': '함께 이야기를 만들어 봅시다. AI가 처음 세 글자를 제공하고, 그 후 번갈아가며 한 글자씩 추가하여 문장을 완성합니다.',
    'initialPrompt': '이야기를 시작하기 위해 첫 세 글자만 제공해주세요. 문장부호 없이',
    'nextCharPrompt': '문맥을 고려하여 문장이 자연스럽게 흐르도록 다음 한 글자만 제공하여 이야기를 계속해주세요. 현재 텍스트: '
  }
};

// 辅助函数：调用LLM API
async function callLlmApi(prompt, systemPrompt) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: API_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 10,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('LLM API error:', error);
    throw error;
  }
}

// 开始游戏API
export async function startGame(req, res) {
  try {
    const { language = 'zh' } = req.body;
    const sessionId = uuidv4();
    
    // 获取LLM生成的初始三个字
    const systemPrompt = translations[language].startingPrompt;
    const prompt = translations[language].initialPrompt;
    
    const response = await callLlmApi(prompt, systemPrompt);
    const initialText = response.substring(0, 3); // 取前三个字
    
    // 保存会话信息
    sessions[sessionId] = {
      text: initialText,
      language
    };
    
    return res.status(200).json({
      sessionId,
      initialText
    });
  } catch (error) {
    console.error('Start game error:', error);
    return res.status(500).json({ error: 'Failed to start game' });
  }
}

// 获取下一个字API
export async function getNextCharacter(req, res) {
  try {
    const { sessionId, currentText, language = 'zh' } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    // 更新会话中的文本
    sessions[sessionId].text = currentText;
    
    // 获取LLM生成的下一个字
    const systemPrompt = translations[language].startingPrompt;
    const prompt = translations[language].nextCharPrompt + currentText;
    
    const response = await callLlmApi(prompt, systemPrompt);
    const nextChar = response.charAt(0); // 只取第一个字
    
    // 更新会话中的文本
    sessions[sessionId].text += nextChar;
    
    return res.status(200).json({
      nextChar
    });
  } catch (error) {
    console.error('Get next character error:', error);
    return res.status(500).json({ error: 'Failed to get next character' });
  }
}

// Vercel Serverless Function处理器
export default async function handler(req, res) {
  // 添加CORS头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 根据路径分发请求
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/api/start-game' && req.method === 'POST') {
    return await startGame(req, res);
  }
  
  if (pathname === '/api/next-character' && req.method === 'POST') {
    return await getNextCharacter(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
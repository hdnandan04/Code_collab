import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

interface ExecuteRequest {
  code: string;
  language: string;
}

// Language ID mapping for Judge0
const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
};

// Mock execution (fallback if no Judge0 API key)
const mockExecute = (code: string, language: string) => {
  return {
    stdout: `Hello, World!\n(Mock execution - configure Judge0 for real execution)\nLanguage: ${language}\nCode length: ${code.length} characters`,
    stderr: '',
    status: { description: 'Accepted' },
    time: '0.12',
    memory: 2048,
  };
};

router.post('/', async (req: Request<{}, {}, ExecuteRequest>, res: Response) => {
  const { code, language } = req.body;

  console.log(`🚀 Executing ${language} code (${code.length} chars)`);

  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  try {
    // Use Judge0 API if configured
    if (process.env.JUDGE0_API_KEY && process.env.JUDGE0_URL) {
      console.log('📡 Using Judge0 API for execution');
      
      const response = await axios.post(
        `${process.env.JUDGE0_URL}/submissions`,
        {
          source_code: Buffer.from(code).toString('base64'),
          language_id: languageId,
          stdin: '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
          params: {
            base64_encoded: 'true',
            wait: 'true',
          },
        }
      );

      const result = response.data;
      
      console.log('✅ Code executed successfully');
      
      return res.json({
        stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
        stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '',
        status: result.status.description,
        time: result.time,
        memory: result.memory,
      });
    } else {
      // Fallback to mock execution
      console.log('⚠️  Using mock execution (Judge0 not configured)');
      const result = mockExecute(code, language);
      return res.json(result);
    }
  } catch (error) {
    console.error('❌ Execution error:', error);
    return res.status(500).json({
      error: 'Execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
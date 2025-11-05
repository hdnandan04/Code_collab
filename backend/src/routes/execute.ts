import { Router, Request, Response } from 'express';
import axios from 'axios'; // <-- NO longer importing AxiosError
import { AuthRequest } from '../middleware/auth'; 

const router = Router();

interface ExecuteRequest {
  code: string;
  language: string;
}

// Interface to match the Judge0 response
interface Judge0Result {
  stdout?: string;
  stderr?: string;
  status: { description: string };
  time: string;
  memory: number;
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
const mockExecute = (code: string, language: string): Judge0Result => {
  if (code.toLowerCase().includes('error')) {
    return {
      stdout: '',
      stderr: `Mock ${language} Error:\nSyntaxError: Unexpected token "error" on line 1`,
      status: { description: 'Runtime Error' },
      time: '0.01',
      memory: 1024,
    };
  }

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

      // --- FIX 1: Cast the data to the correct type to resolve TS2322 ---
      const result: Judge0Result = response.data as Judge0Result;
      
      console.log('✅ Code executed successfully');
      
      return res.json({
        stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
        stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '',
        status: result.status.description,
        time: result.time,
        memory: result.memory,
      });
    } else {
      console.log('⚠️  Using mock execution (Judge0 not configured)');
      const result = mockExecute(code, language);
      return res.json(result);
    }
  } catch (error: any) { // <-- Use 'any' for the catch block parameter to be safe
    console.error('❌ Execution error:', error);
    
    // --- FIX 2: Use the existing check (TS will still complain, but we skip the type error) ---
    // The previous error was a circular dependency error from the build environment.
    // We trust that the JS works and bypass the TS error by checking for the 'response' property.
    if (error.response) { // If the error object has a 'response' property (common in Axios errors)
        console.error('Axios error data:', error.response.data);
        return res.status(500).json({
            error: 'Execution failed',
            stderr: JSON.stringify(error.response.data, null, 2),
        });
    }
    
    // Fallback for non-Axios errors
    return res.status(500).json({
      error: 'Execution failed',
      stderr: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

export default router;

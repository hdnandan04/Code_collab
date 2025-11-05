import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor, { loader } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Play,
  Copy,
  Users,
  MessageSquare,
  Terminal,
  LogOut,
  ChevronRight,
  Send,
  Code2,
  Sparkles,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Clipboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { getAuthToken, removeAuthToken } from '@/lib/auth';
import { jwtDecode } from 'jwt-decode';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

// --- (Theme and Interfaces are unchanged) ---
loader.init().then((monaco) => {
  monaco.editor.defineTheme('tech-noir', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6c7a8a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '00ffff' },
      { token: 'string', foreground: 'a0e0a0' },
      { token: 'number', foreground: 'b0b0ff' },
      { token: 'identifier', foreground: 'e6e6e9' },
      { token: 'operator', foreground: '00ffff' },
      { token: 'delimiter', foreground: 'e6e6e9' },
      { token: 'tag', foreground: '00ffff' },
      { token: 'attribute.name', foreground: '00ffff' },
      { token: 'attribute.value', foreground: 'a0e0a0' },
    ],
    colors: {
      'editor.background': '#141c26',
      'editor.foreground': '#e6e6e9',
      'editorLineNumber.foreground': '#7a8a99',
      'editor.selectionBackground': '#00ffff33',
      'editorCursor.foreground': '#00ffff',
      'editorGutter.background': '#141c26',
      'editorWidget.background': '#1a2433',
      'editorWidget.border': '#339999',
    },
  });
});

interface JwtPayload {
  id: string;
  username: string;
  iat: number;
  exp: number;
}
interface Participant {
  id: string;
  username: string;
  color: string;
}
interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}
interface IAiChatMessage {
  role: 'user' | 'model';
  text: string;
}
interface ConsoleOutput {
  type: 'info' | 'error' | 'success';
  text: string;
  timestamp: number;
}
interface ExecutionResult {
  stdout: string;
  stderr: string;
  status: string;
  time: string;
  memory: number;
  error?: string;
}

const Workspace = () => {
  const { projectId: roomId } = useParams();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState<string>('');
  const [code, setCode] = useState(
    "// Welcome to your AI-powered editor!\n// Ask the AI to fix this code.\n\nfunction findBug() {\n  let i = 10;\n  for (let i = 0; i < 5; i++) {\n    console.log(i);\n  }\n  console.log(i); // What will this log?\n}\n\nfindBug();"
  );
  const [language, setLanguage] = useState('javascript');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'chat' | 'people' | 'ai'>('chat');
  
  const [aiChatHistory, setAiChatHistory] = useState<IAiChatMessage[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  // --- (All handlers and effects are unchanged) ---
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      toast.error('Authentication error. Please log in.');
      navigate('/login');
      return;
    }
    let decodedToken: JwtPayload;
    try {
      decodedToken = jwtDecode<JwtPayload>(token);
      setUsername(decodedToken.username);
    } catch (error) {
      toast.error('Invalid session. Please log in again.');
      removeAuthToken();
      navigate('/login');
      return;
    }
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
    if (!SOCKET_URL) {
      console.error('VITE_SOCKET_URL is not defined in .env');
      toast.error('Client config error. Check .env');
      addConsoleOutput(
        'error',
        'VITE_SOCKET_URL is not defined. Cannot connect to server.'
      );
      return;
    }
    socketRef.current = io(SOCKET_URL, {
      query: { roomId },
      auth: {
        token: token,
      },
    });
    const socket = socketRef.current;
    socket.on('connect', () => {
      addConsoleOutput('info', `Connected to room: ${roomId}`);
      toast.success('Connected to room!');
    });
    socket.on('connect_error', (err) => {
      addConsoleOutput('error', `Failed to connect to server: ${err.message}`);
      toast.error('Connection failed - offline mode', {
        description: err.message,
      });
    });
    socket.on('room-joined', (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
      const participantUsernames = data.participants.map(p => p.username);
      addConsoleOutput(
        'info',
        `Room members: ${participantUsernames.join(', ')}`
      );
    });
    socket.on('code-update', (newCode: string) => {
      setCode(newCode);
    });
    socket.on('code-snapshot', (snapshot: string) => {
      setCode(snapshot);
    });
    socket.on('language-update', (newLanguage: string) => {
      setLanguage(newLanguage);
      toast.info(`Language changed to ${newLanguage}`);
    });
    socket.on('chat-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });
    socket.on('chat-history', (history: Message[]) => {
      setMessages(history);
    });
    return () => {
      socket.disconnect();
    };
  }, [roomId, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleOutput]);

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatHistory, isAiLoading]);

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      socketRef.current?.emit('code-change', { roomId, code: value });
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socketRef.current?.emit('language-change', {
      roomId,
      language: newLanguage,
    });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    if (!username) { 
      toast.error("Cannot send message, user not identified.");
      return;
    }
    const message: Message = {
      id: Date.now().toString(),
      username,
      text: chatInput,
      timestamp: Date.now(),
    };
    socketRef.current?.emit('chat-message', { roomId, message });
    setChatInput('');
  };

  const copyCodeFromMessage = (text: string) => {
    const match = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
    if (match && match[1]) {
      navigator.clipboard.writeText(match[1].trim());
      toast.success('Code copied to clipboard!');
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Text copied to clipboard!');
    }
  };

  const handleSendAiMessage = async () => {
    if (!aiChatInput.trim()) return;
    const token = getAuthToken();
    const currentPrompt = aiChatInput;
    const currentCode = code;
    const historyForApi = aiChatHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    setIsAiLoading(true);
    setAiChatInput('');
    setAiChatHistory(prev => [...prev, { role: 'user', text: currentPrompt }]);
    try {
      const response = await fetch(`${import.meta.env.VITE_SOCKET_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          codeContext: currentCode,
          language: language,
          chatHistory: historyForApi,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error from AI service');
      }
      setAiChatHistory(prev => [...prev, { role: 'model', text: result.aiResponse }]);
    } catch (error) {
      toast.error((error as Error).message);
      setAiChatHistory(prev => prev.slice(0, -1)); 
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    addConsoleOutput('info', `Executing ${language} code...`);
    const backendUrl = import.meta.env.VITE_SOCKET_URL;
    if (!backendUrl) {
      addConsoleOutput('error', 'VITE_SOCKET_URL is not configured.');
      setIsRunning(false);
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const result: ExecutionResult = await response.json();
      if (!response.ok) {
        const errorText = result.stderr || result.error || 'Server-side execution error';
        throw new Error(errorText);
      }
      const hasError = result.stderr || (result.status && result.status !== 'Accepted');
      if (hasError) {
        const errorOutput = (result.status && result.status !== 'Accepted' ? `Status: ${result.status}\n` : '') + (result.stderr || '');
        addConsoleOutput('error', errorOutput || 'Code execution failed');
        toast.error('Code executed with errors.');
      } else {
        addConsoleOutput(
          'success',
          result.stdout || '(Execution finished with no output)'
        );
        toast.success('Code executed successfully!');
      }
      addConsoleOutput(
        'info',
        `Execution completed in ${result.time || 0}s (Memory: ${
          result.memory || 0
        } KB)`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Network or server error';
      addConsoleOutput('error', `Error: ${errorMessage}`);
      toast.error('Execution failed', { description: errorMessage });
    } finally {
      setIsRunning(false);
    }
  };

  const addConsoleOutput = (type: ConsoleOutput["type"], text: string) => {
    const outputText = String(text || '');
    setConsoleOutput((prev) => [
      ...prev,
      { type, text: outputText, timestamp: Date.now() },
    ]);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId || '');
    toast.success('Room ID copied to clipboard!');
  };

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold flex items-center gap-2 font-vt323 text-primary text-[2rem]">
            <Code2 className="w-5 h-5 text-primary" />
            CodeCollab
          </h1>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Room:</span>
            <code className="px-2 py-1 rounded-sm bg-muted text-sm font-mono text-primary">
              {roomId}
            </code>
            <Button variant="ghost" size="sm" onClick={copyRoomId}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{participants.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={leaveRoom}>
            <LogOut className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 flex overflow-hidden">
        
        {/* --- Editor & Console Panel --- */}
        <ResizablePanel defaultSize={70} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            
            {/* --- Top: Editor Panel --- */}
            <ResizablePanel defaultSize={75} minSize={20} className="flex-1 flex flex-col">
              {/* Editor Toolbar */}
              <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    className="px-3 py-1 rounded-sm border border-input bg-background text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                </div>
                <Button onClick={handleRunCode} disabled={isRunning} size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? 'Running...' : 'Run Code'}
                </Button>
              </div>
              {/* Monaco Editor */}
              <div className="flex-1 relative">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={handleCodeChange}
                  theme="tech-noir"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                  }}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* --- Bottom: Console Panel --- */}
            <ResizablePanel defaultSize={25} minSize={10} className="flex flex-col">
              <Card className="m-0 border-0 rounded-none flex-1 flex flex-col">
                <div className="h-10 border-b border-border flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Console</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConsoleOutput([])}
                  >
                    Clear
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-1 font-mono text-xs">
                    {consoleOutput.map((output, idx) => (
                      <div
                        key={`${output.timestamp}-${idx}`} 
                        className={
                          output.type === 'error'
                            ? 'text-red-400'
                            : output.type === 'success'
                            ? 'text-green-400'
                            : 'text-muted-foreground'
                        }
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        <ChevronRight className="w-3 h-3 inline mr-1" />
                        {output.text}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </ScrollArea>
              </Card>
            </ResizablePanel>

          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* --- Sidebar Panel --- */}
        <ResizablePanel defaultSize={30} minSize={10} maxSize={50} className="w-80 border-l border-border bg-card flex flex-col">
          {/* Sidebar Tabs */}
          <div className="h-12 border-b border-border flex">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('people')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'people'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'ai'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI
            </button>
          </div>

          {/* --- Content (Chat) --- */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color:
                              participants.find(
                                (p) => p.username === msg.username
                              )?.color || 'hsl(var(--primary))',
                          }}
                        >
                          {msg.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* --- Content (People) --- */}
          {activeTab === 'people' && (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {participants
                  .filter(p => p && p.username)
                  .map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 rounded-sm bg-muted/50"
                  >
                    <div
                      className="w-8 h-8 rounded-sm flex items-center justify-center text-sm font-bold text-black"
                      style={{ backgroundColor: participant.color }}
                    >
                      {participant.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {participant.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active now
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {participant.id === socketRef.current?.id
                        ? 'You'
                        : 'Guest'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {/* --- Content (AI Chat) --- */}
          {activeTab === 'ai' && (
            // --- ⬇️ FIX: Main container ensures flex-col sizing ⬇️ ---
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {aiChatHistory.map((msg, idx) => (
                    <div key={`${msg.role}-${idx}`} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`p-3 rounded-lg max-w-[90%] ${msg.role === 'user' ? 'bg-cyan-900/50' : 'bg-gray-700/50'}`}
                            style={{ whiteSpace: 'pre-wrap' }} 
                        >
                            <p className="text-sm text-foreground">{msg.text}</p>
                            
                            {/* Copy Code Button */}
                            {msg.role === 'model' && msg.text.includes('```') && (
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="mt-2 text-xs h-6 bg-cyan-700/30 hover:bg-cyan-700/50 text-cyan-200"
                                    onClick={() => copyCodeFromMessage(msg.text)}
                                >
                                    <Clipboard className="w-3 h-3 mr-1" />
                                    Copy Code
                                </Button>
                            )}
                        </div>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-gray-700/50">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={aiChatEndRef} />
                </div>
              </ScrollArea>
              {/* --- ⬆️ FIX: Scroll Area is now correctly contained ⬆️ --- */}

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask AI to fix or explain code..."
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isAiLoading && handleSendAiMessage()}
                    disabled={isAiLoading}
                  />
                  <Button onClick={handleSendAiMessage} size="icon" disabled={isAiLoading}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Workspace;
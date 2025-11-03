import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Editor, { loader } from "@monaco-editor/react"; // Import loader
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

// --- ⬇️ NEW CUSTOM EDITOR THEME ⬇️ ---
// Define the custom theme before the component renders
loader.init().then((monaco) => {
  monaco.editor.defineTheme("tech-noir", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6c7a8a", fontStyle: "italic" }, // Muted grey-blue
      { token: "keyword", foreground: "00ffff" }, // Electric Cyan
      { token: "string", foreground: "a0e0a0" }, // Soft Green
      { token: "number", foreground: "b0b0ff" }, // Soft Blue/Purple
      { token: "identifier", foreground: "e6e6e9" }, // Off-white
      { token: "operator", foreground: "00ffff" }, // Electric Cyan
      { token: "delimiter", foreground: "e6e6e9" }, // Off-white
      { token: "tag", foreground: "00ffff" }, // Electric Cyan
      { token: "attribute.name", foreground: "00ffff" }, // Electric Cyan
      { token: "attribute.value", foreground: "a0e0a0" }, // Soft Green
    ],
    colors: {
      "editor.background": "#141c26", // hsl(220 20% 8%) - Main BG
      "editor.foreground": "#e6e6e9", // hsl(220 10% 90%) - Main Text
      "editorLineNumber.foreground": "#7a8a99", // hsl(220 10% 60%) - Muted
      "editor.selectionBackground": "#00ffff33", // Cyan with alpha
      "editorCursor.foreground": "#00ffff", // Cyan
      "editorGutter.background": "#141c26", // Main BG
      "editorWidget.background": "#1a2433", // Card BG
      "editorWidget.border": "#339999", // Border
    },
  });
});
// --- ⬆️ NEW CUSTOM EDITOR THEME ⬆️ ---

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

interface ConsoleOutput {
  type: "info" | "error" | "success";
  text: string;
  timestamp: number;
}

// This interface matches the backend execute.ts response
interface ExecutionResult {
  stdout: string;
  stderr: string;
  status: string;
  time: string;
  memory: number;
  error?: string; // For network or server errors
}

const Workspace = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const username = searchParams.get("username") || "Anonymous";

  const [code, setCode] = useState(
    "// Welcome to the Tech-Noir Collab!\n\nfunction hello() {\n  console.log('Hello, World!');\n}\n\nhello();"
  );
  const [language, setLanguage] = useState("javascript");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showConsole, setShowConsole] = useState(true); // Default to true

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null); // Ref for console scroll

  useEffect(() => {
    // Initialize Socket.IO connection
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

    if (!SOCKET_URL) {
      console.error("VITE_SOCKET_URL is not defined in .env");
      toast.error("Client config error. Check .env");
      addConsoleOutput(
        "error",
        "VITE_SOCKET_URL is not defined. Cannot connect to server."
      );
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      query: { roomId, username },
    });

    const socket = socketRef.current;

    // Connection events
    socket.on("connect", () => {
      addConsoleOutput("info", `Connected to room: ${roomId}`);
      toast.success("Connected to room!");
    });

    socket.on("connect_error", (err) => {
      addConsoleOutput("error", `Failed to connect to server: ${err.message}`);
      toast.error("Connection failed - offline mode", {
        description: err.message,
      });
    });

    // Room events
    socket.on("room-joined", (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
      addConsoleOutput(
        "success",
        `Joined room with ${data.participants.length} participant(s)`
      );
    });

    socket.on("user-joined", (participant: Participant) => {
      setParticipants((prev) => [...prev, participant]);
      addConsoleOutput("info", `${participant.username} joined the room`);
      toast(`${participant.username} joined`, { icon: "👋" });
    });

    socket.on("user-left", (userId: string) => {
      setParticipants((prev) => {
        const user = prev.find((p) => p.id === userId);
        if (user) {
          addConsoleOutput("info", `${user.username} left the room`);
          toast(`${user.username} left`, { icon: "👋" });
        }
        return prev.filter((p) => p.id !== userId);
      });
    });

    // Code sync events
    socket.on("code-update", (newCode: string) => {
      setCode(newCode);
    });

    socket.on("code-snapshot", (snapshot: string) => {
      setCode(snapshot);
    });

    // --- ⬇️ LANGUAGE SYNC LISTENER ⬇️ ---
    socket.on("language-update", (newLanguage: string) => {
      setLanguage(newLanguage);
      toast.info(`Language changed to ${newLanguage}`);
    });
    // --- ⬆️ LANGUAGE SYNC LISTENER ⬆️ ---

    // Chat events
    socket.on("chat-message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("chat-history", (history: Message[]) => {
      setMessages(history);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, username]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleOutput]);

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      socketRef.current?.emit("code-change", { roomId, code: value });
    }
  };

  // --- ⬇️ LANGUAGE SYNC EMITTER ⬇️ ---
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socketRef.current?.emit("language-change", {
      roomId,
      language: newLanguage,
    });
  };
  // --- ⬆️ LANGUAGE SYNC EMITTER ⬆️ ---

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      username,
      text: chatInput,
      timestamp: Date.now(),
    };

    socketRef.current?.emit("chat-message", { roomId, message });
    setChatInput("");
  };

  // --- ⬇️ UPDATED CODE EXECUTION ⬇️ ---
  const handleRunCode = async () => {
    setIsRunning(true);
    setShowConsole(true);
    addConsoleOutput("info", `Executing ${language} code...`);

    const backendUrl = import.meta.env.VITE_SOCKET_URL;
    if (!backendUrl) {
      addConsoleOutput("error", "VITE_SOCKET_URL is not configured.");
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      const result: ExecutionResult = await response.json();

      if (response.ok) {
        if (result.stderr) {
          // Code ran but had an error (e.g., syntax error)
          addConsoleOutput("error", result.stderr);
          toast.error("Code executed with errors.");
        } else {
          // Code ran successfully
          addConsoleOutput(
            "success",
            result.stdout || "(Execution finished with no output)"
          );
          toast.success("Code executed successfully!");
        }
        addConsoleOutput(
          "info",
          `Execution completed in ${result.time || 0}s (Memory: ${
            result.memory || 0
          } KB)`
        );
      } else {
        // Server error (e.g., 500, or Judge0 error)
        throw new Error(
          result.error || result.stderr || "Unknown execution error"
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Network or server error";
      addConsoleOutput("error", `Error: ${errorMessage}`);
      toast.error("Execution failed", { description: errorMessage });
    } finally {
      setIsRunning(false);
    }
  };
  // --- ⬆️ UPDATED CODE EXECUTION ⬆️ ---

  const addConsoleOutput = (type: ConsoleOutput["type"], text: string) => {
    // Ensure text is a string, even if null or undefined
    const outputText = String(text || "");
    setConsoleOutput((prev) => [
      ...prev,
      { type, text: outputText, timestamp: Date.now() },
    ]);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId || "");
    toast.success("Room ID copied to clipboard!");
  };

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    navigate("/");
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
          _
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col">
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
              {isRunning ? "Running..." : "Run Code"}
            </Button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 relative">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleCodeChange}
              // --- ⬇️ UPDATED THEME ⬇️ ---
              theme="tech-noir"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                fontFamily: "'Space Mono', monospace", // Set editor font
              }}
              // --- ⬆️ UPDATED THEME ⬆️ ---
            />
          </div>

          {/* Console Output */}
          {showConsole && (
            <Card className="m-4 mt-0 border-border">
              <div className="h-48 flex flex-col">
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
                        key={idx}
                        className={
                          output.type === "error"
                            ? "text-red-400" // Standard bright red for errors
                            : output.type === "success"
                            ? "text-green-400" // Standard bright green for output
                            : "text-muted-foreground"
                        }
                      >
                        <ChevronRight className="w-3 h-3 inline mr-1" />
                        {output.text}
                      </div>
                    ))}
                    <div ref={consoleEndRef} /> {/* Ref for scrolling */}
                  </div>
                </ScrollArea>
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-border bg-card flex flex-col">
          {/* Sidebar Tabs */}
          <div className="h-12 border-b border-border flex">
            <button
              onClick={() => setShowChat(true)}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                showChat
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setShowChat(false)}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                !showChat
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
          </div>

          {/* Content */}
          {showChat ? (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        {/* --- ⬇️ UPDATED USERNAME COLOR ⬇️ --- */}
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color:
                              participants.find(
                                (p) => p.username === msg.username
                              )?.color || "hsl(var(--primary))", // Fallback to primary
                          }}
                        >
                          {msg.username}
                        </span>
                        {/* --- ⬆️ UPDATED USERNAME COLOR ⬆️ --- */}
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
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {participants.map((participant) => (
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
                        ? "You"
                        : "Guest"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

export default Workspace;


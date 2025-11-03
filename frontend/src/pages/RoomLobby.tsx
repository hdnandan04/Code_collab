import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Users, Zap } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const RoomLobby = () => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    if (!username.trim()) {
      toast.error("Please enter your username");
      return;
    }
    const newRoomId = nanoid(10);
    navigate(`/room/${newRoomId}?username=${encodeURIComponent(username)}`);
  };

  const joinRoom = () => {
    if (!username.trim()) {
      toast.error("Please enter your username");
      return;
    }
    if (!roomId.trim()) {
      toast.error("Please enter a room ID");
      return;
    }
    navigate(`/room/${roomId}?username=${encodeURIComponent(username)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Real-time Collaboration</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            Code Together,
            <span className="text-primary"> Build Faster</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Collaborate in real-time with shared code editing, live chat, and instant execution
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <Code2 className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Live Code Sync</h3>
              <p className="text-sm text-muted-foreground">
                See changes in real-time with cursor tracking
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Team Chat</h3>
              <p className="text-sm text-muted-foreground">
                Discuss code changes instantly
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Run Code</h3>
              <p className="text-sm text-muted-foreground">
                Execute and test code together
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Join/Create Room Card */}
        <Card className="glass-panel shadow-2xl">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Enter your username to create or join a coding session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createRoom()}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <Button
                  onClick={createRoom}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Code2 className="w-5 h-5 mr-2" />
                  Create New Room
                </Button>
              </div>

              <div className="space-y-4">
                <Input
                  placeholder="Enter room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="h-12"
                />
                <Button
                  onClick={joinRoom}
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Users className="w-5 h-5 mr-2" />
                  Join Room
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          
        </div>
      </div>
    </div>
  );
};

export default RoomLobby;

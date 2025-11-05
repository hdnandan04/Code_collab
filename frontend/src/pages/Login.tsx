import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
// --- 1. IMPORT PATH ---
// Mi path '@/' varun '../lib/auth' madhe badalla aahe
import { saveAuthToken } from '../lib/auth';
import { Code2 } from 'lucide-react';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_SOCKET_URL;

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Backend la 'username' pathavto
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      saveAuthToken(data.token);
      toast.success('Login successful!');
      // Login nantar '/' (Dashboard) var redirect kara
      navigate('/'); 

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Login Failed', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background font-mono p-4">
      <Card className="w-full max-w-md bg-card border-cyan-400/50">
        <CardHeader className="items-center text-center">
          <Code2 className="w-12 h-12 text-cyan-400" />
          <CardTitle className="text-3xl font-bold text-cyan-400">Welcome to CodeCollab</CardTitle>
          <CardDescription className="text-gray-400">Log in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. hdnandan"
                required
                value={username}
                // --- 2. SYNTAX FIX ---
                // 'e.g. target.value' badlun 'e.target.value' kela
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                // --- 2. SYNTAX FIX ---
                // 'e.g. target.value' badlun 'e.target.value' kela
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>
          <Button onClick={handleLogin} disabled={isLoading} className="w-full mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
          <div className="mt-4 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="underline text-cyan-400 hover:text-cyan-300">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
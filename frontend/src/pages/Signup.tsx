import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
// --- FIXED IMPORT PATH ---
import { saveAuthToken } from '../lib/auth'; // Changed from @/
import { Code2 } from 'lucide-react';

export const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_SOCKET_URL;

  const handleSignup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Signup route sends all three fields
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      saveAuthToken(data.token);
      toast.success('Account created successfully!');
      navigate('/'); // Redirect to dashboard

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Signup Failed', {
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
          <CardTitle className="text-3xl font-bold text-cyan-400">Create Your Account</CardTitle>
          <CardDescription className="text-gray-400">Join CodeCollab</CardDescription>
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
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSignup} disabled={isLoading} className="w-full mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>
          <div className="mt-4 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="underline text-cyan-400 hover:text-cyan-300">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
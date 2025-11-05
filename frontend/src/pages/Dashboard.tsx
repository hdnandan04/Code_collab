import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
}from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getAuthToken, removeAuthToken } from '@/lib/auth';
// --- ⬇️ IMPORTS UPDATED ⬇️ ---
import { Code2, Plus, Users, LogOut, Loader2, UserPlus, Trash2, UserMinus, Check, X } from 'lucide-react';
// --- ⬆️ IMPORTS UPDATED ⬆️ ---
import { jwtDecode } from 'jwt-decode';

// Interface for the JWT payload
interface JwtPayload {
  id: string;
  username: string;
}

// This interface must match the backend's Project model
interface IProject {
  _id: string;
  name: string;
  owner: {
    _id: string;
    username: string;
  } | null;
  members: {
    _id: string;
    username: string;
  }[];
  lastModified: string;
}

// --- ⬇️ NEW: Interface for Invitation data ⬇️ ---
interface IInvitation {
  _id: string;
  project: {
    _id: string;
    name: string;
  };
  inviter: {
    _id: string;
    username: string;
  };
  status: 'pending';
}
// --- ⬆️ NEW: Interface for Invitation data ⬆️ ---

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<IProject[]>([]);
  // --- ⬇️ NEW: State for invitations ⬇️ ---
  const [invitations, setInvitations] = useState<IInvitation[]>([]);
  // --- ⬆️ NEW: State for invitations ⬆️ ---
  const [isLoading, setIsLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- STATE FOR INVITES ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<IProject | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // --- STATE FOR DELETE/LEAVE ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const API_URL = import.meta.env.VITE_SOCKET_URL;

  // --- ⬇️ 1. UPDATED: Fetch projects AND invitations ⬇️ ---
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      toast.error('You are not logged in.');
      navigate('/login');
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      setCurrentUserId(decoded.id);
    } catch (e) {
      toast.error('Invalid session. Please log in again.');
      removeAuthToken();
      navigate('/login');
      return;
    }

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        // Run fetches in parallel
        const [projectsResponse, invitesResponse] = await Promise.all([
          fetch(`${API_URL}/api/projects`, { headers }),
          fetch(`${API_URL}/api/invitations`, { headers })
        ]);

        // Handle project response
        if (!projectsResponse.ok) {
          if (projectsResponse.status === 401) throw new Error('Session expired. Please log in again.');
          throw new Error('Failed to fetch projects');
        }
        const projectsData: IProject[] = await projectsResponse.json();
        setProjects(projectsData);

        // Handle invitations response
        if (!invitesResponse.ok) {
          if (invitesResponse.status === 401) throw new Error('Session expired. Please log in again.');
          throw new Error('Failed to fetch invitations');
        }
        const invitesData: IInvitation[] = await invitesResponse.json();
        setInvitations(invitesData);

      } catch (error) {
        toast.error((error as Error).message);
        if ((error as Error).message.includes('Session expired')) {
          removeAuthToken();
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [navigate, API_URL]);
  // --- ⬆️ 1. UPDATED: Fetch projects AND invitations ⬆️ ---

  // 2. Handle creation of a new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    const token = getAuthToken();
    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newProjectName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create project');
      }

      const newProject: IProject = await response.json();
      setProjects([newProject, ...projects]);
      toast.success(`Project "${newProject.name}" created!`);
      
      setIsDialogOpen(false);
      setNewProjectName('');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  // 3. Handle user logout
  const handleLogout = () => {
    removeAuthToken();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // --- ⬇️ 4. UPDATED: Handle sending an invite ⬇️ ---
  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !currentProject) {
      toast.error('Email/Username cannot be empty.');
      return;
    }

    const token = getAuthToken();
    setIsInviting(true);

    try {
      const response = await fetch(`${API_URL}/api/projects/${currentProject._id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emailOrUsername: inviteEmail }),
      });

      const result = await response.json(); 

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send invite');
      }

      // --- LOGIC CHANGED ---
      // We no longer update the member count, just show success
      toast.success(result.message || 'Invitation sent!');
      // --- END OF CHANGE ---

      setIsInviteDialogOpen(false);
      setInviteEmail('');

    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsInviting(false);
    }
  };
  // --- ⬆️ 4. UPDATED: Handle sending an invite ⬆️ ---

  // 5. Handle DELETING a project (Owner)
  const handleDeleteProject = async () => {
    if (!currentProject) return;

    const token = getAuthToken();
    setIsProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/projects/${currentProject._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete project');
      }

      toast.success(`Project "${currentProject.name}" deleted`);
      
      setProjects(prevProjects => 
        prevProjects.filter(p => p._id !== currentProject._id)
      );
      
      setIsDeleteDialogOpen(false);
      setCurrentProject(null);

    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Handle LEAVING a project (Member)
  const handleLeaveProject = async () => {
    if (!currentProject) return;

    const token = getAuthToken();
    setIsProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/projects/${currentProject._id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to leave project');
      }

      toast.success(`You have left the project "${currentProject.name}"`);
      
      setProjects(prevProjects => 
        prevProjects.filter(p => p._id !== currentProject._id)
      );
      
      setIsLeaveDialogOpen(false);
      setCurrentProject(null);

    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ⬇️ 7. NEW: Handle RESPONDING to an invite (Accept/Reject) ⬇️ ---
  const handleRespondToInvite = async (invitationId: string, action: 'accept' | 'reject') => {
    const token = getAuthToken();
    setIsProcessing(true); // Use generic loader

    try {
      const response = await fetch(`${API_URL}/api/invitations/${invitationId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${action} invite`);
      }

      toast.success(result.message || `Invitation ${action}ed!`);
      
      // Remove the invitation from the UI
      setInvitations(prevInvites => 
        prevInvites.filter(inv => inv._id !== invitationId)
      );

      // If accepted, we must refresh the project list
      if (action === 'accept') {
        const projectsResponse = await fetch(`${API_URL}/api/projects`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        });
        const projectsData = await projectsResponse.json();
        setProjects(projectsData);
      }

    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };
  // --- ⬆️ 7. NEW: Handle RESPONDING to an invite (Accept/Reject) ⬆️ ---

  return (
    <div className="flex flex-col min-h-screen bg-background font-mono text-cyan-100">
      {/* Header */}
      <header className="h-16 border-b border-cyan-900/50 bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Code2 className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold text-cyan-100">
            CodeCollab Dashboard
          </h1>
        </div>
        <Button variant="ghost" onClick={handleLogout} className="text-cyan-400 hover:text-cyan-100 hover:bg-cyan-900/50">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-12">
        
        {/* --- ⬇️ NEW: Pending Invitations Section ⬇️ --- */}
        {!isLoading && invitations.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-cyan-100 mb-8">Pending Invitations</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {invitations.map((invite) => (
                <Card 
                  key={invite._id} 
                  className="bg-gray-800/70 border-yellow-900/50 text-yellow-100 flex flex-col justify-between"
                >
                  <CardHeader>
                    <CardTitle className="text-yellow-400 text-xl">{invite.project.name}</CardTitle>
                    <CardDescription className="text-yellow-300/70">
                      Invited by: {invite.inviter.username}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-yellow-300/80">You have a pending invitation to join this project.</p>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button 
                      className="w-full bg-green-700/80 hover:bg-green-700/100 text-white"
                      onClick={() => handleRespondToInvite(invite._id, 'accept')}
                      disabled={isProcessing}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full bg-red-800/60 hover:bg-red-800/90 text-red-100"
                      onClick={() => handleRespondToInvite(invite._id, 'reject')}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
        {/* --- ⬆️ NEW: Pending Invitations Section ⬆️ --- */}


        {/* Create Project Button */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-cyan-100">My Projects</h2>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-cyan-950 font-bold shadow-cyan-500/30 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Create New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-gray-900 border-cyan-900/50 text-cyan-100 font-mono">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">Create New Project</DialogTitle>
                <DialogDescription className="text-cyan-300/70">
                  Give your new project a name. You can invite collaborators later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right text-cyan-400">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="col-span-3 bg-gray-800 border-cyan-900/50 text-cyan-100 focus-visible:ring-cyan-500"
                    placeholder="My Awesome Project"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateProject} 
                  disabled={isCreating} 
                  className="bg-cyan-600 hover:bg-cyan-500 text-cyan-950 font-bold"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project List */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : projects.length === 0 && invitations.length === 0 ? ( // <-- Only show if no projects AND no invites
          <div className="text-center text-cyan-300/70">
            <p>You don't have any projects or invitations yet.</p>
            <p>Click "Create New Project" to get started!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.filter(Boolean).map((project) => (
              <Card 
                key={project._id} 
                className="bg-gray-900/70 border-cyan-900/50 text-cyan-100 flex flex-col justify-between transition-all duration-300 hover:shadow-cyan-500/20 hover:shadow-lg hover:border-cyan-900/80"
              >
                <CardHeader>
                  <CardTitle className="text-cyan-400 text-xl">{project.name}</CardTitle>
                  <CardDescription className="text-cyan-300/70">
                    Owned by: {project.owner?.username || 'Unknown'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-cyan-300/80">
                    <Users className="w-4 h-4" />
                    <span>{project.members?.length || 0} member(s)</span>
                  </div>
                  <p className="text-xs text-cyan-300/50 mt-4">
                    Last modified: {new Date(project.lastModified).toLocaleString()}
                  </p>
                </CardContent>
                
                <CardFooter className="flex flex-col gap-2">
                  <Button asChild className="w-full bg-cyan-700/50 hover:bg-cyan-700/80 text-cyan-100">
                    <Link to={`/project/${project._id}`}>
                      Open Project
                    </Link>
                  </Button>

                  {/* --- Owner Buttons --- */}
                  {project.owner?._id === currentUserId && ( 
                    <>
                      <Button 
                        variant="outline" 
                        className="w-full border-cyan-700/50 hover:bg-cyan-700/20 text-cyan-300"
                        onClick={() => {
                          setCurrentProject(project); 
                          setIsInviteDialogOpen(true);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full bg-red-800/60 hover:bg-red-800/90 text-red-100 border-red-500/50"
                        onClick={() => {
                          setCurrentProject(project); 
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Project
                      </Button>
                    </>
                  )}

                  {/* --- Member Button --- */}
                  {project.owner?._id !== currentUserId && ( 
                    <Button 
                      variant="outline" 
                      className="w-full border-red-700/50 hover:bg-red-700/20 text-red-300 hover:text-red-100"
                      onClick={() => {
                        setCurrentProject(project); 
                        setIsLeaveDialogOpen(true);
                      }}
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Leave Project
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* --- Invite Dialog (sits outside the map) --- */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-gray-900 border-cyan-900/50 text-cyan-100 font-mono">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Invite Member</DialogTitle>
              <DialogDescription className="text-cyan-300/70">
                Invite a user to "{currentProject?.name}" by their email or username.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right text-cyan-400">
                  User
                </Label>
                <Input
                  id="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="col-span-3 bg-gray-800 border-cyan-900/50 text-cyan-100 focus-visible:ring-cyan-500"
                  placeholder="user@example.com or username"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleInviteUser} 
                disabled={isInviting} 
                className="bg-cyan-600 hover:bg-cyan-500 text-cyan-950 font-bold"
              >
                {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Send Invite'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- Delete Confirmation Dialog --- */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-gray-900 border-red-900/50 text-red-100 font-mono">
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Project</DialogTitle>
              <DialogDescription className="text-red-300/70">
                Are you sure you want to delete "{currentProject?.name}"? This will permanently
                delete the project, all its code, and chat history for **everyone**. 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                className="text-gray-200 border-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteProject} 
                disabled={isProcessing} 
                variant="destructive"
                className="bg-red-700 hover:bg-red-600 text-red-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Yes, Delete Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- Leave Confirmation Dialog --- */}
        <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-gray-900 border-cyan-900/50 text-cyan-100 font-mono">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Leave Project</DialogTitle>
              <DialogDescription className="text-cyan-300/70">
                Are you sure you want to leave "{currentProject?.name}"? 
                The project will be removed from your dashboard. You will need a new invite to rejoin.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsLeaveDialogOpen(false)}
                className="text-gray-200 border-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleLeaveProject} 
                disabled={isProcessing} 
                className="bg-red-800/60 hover:bg-red-800/90 text-red-100 border-red-500/50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Yes, Leave Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
      </main>
    </div>
  );
};

export default Dashboard;
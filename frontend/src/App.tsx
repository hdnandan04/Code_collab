import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'sonner';

// --- FIXED IMPORTS ---
// Tumcha project '@/' alias vaparto, mhanun relative paths kadhun takle.
import Workspace from '@/pages/Workspace';
import NotFound from '@/pages/NotFound';
import { LoginPage } from '@/pages/Login';
import { SignupPage } from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import { isAuthenticated } from '@/lib/auth';
// --- END OF FIX ---

const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  return isAuthenticated() ? element : <Navigate to="/login" replace />;
};

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route
            path="/"
            element={<ProtectedRoute element={<Dashboard />} />}
          />
          <Route
            path="/project/:projectId"
            element={<ProtectedRoute element={<Workspace />} />}
          />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster 
        theme="dark" 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#0D253A',
            border: '1px solid #06B6D4',
            color: '#E0F2FE',
            fontFamily: 'Space Mono, monospace',
          },
        }}
      />
    </>
  );
}

export default App;
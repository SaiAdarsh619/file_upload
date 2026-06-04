import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Files from './components/Files';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/files" element={
        <ProtectedRoute>
          <Files />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;

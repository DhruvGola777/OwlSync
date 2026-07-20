import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../providers/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';

export const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await register(email, password, name);
      // Registration successful, but they need to verify email before logging in
      navigate('/login?registered=true');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Create your account"
      subtitle={
        <>
          Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
        </>
      }
    >
      <form className="space-y-6" onSubmit={handleRegister}>
        <Input
          label="Full Name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign up
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="w-full flex justify-center" 
            type="button"
            onClick={() => window.location.href = 'http://localhost:4000/api/auth/oauth/google'}
          >
            Google
          </Button>
          <Button 
            variant="outline" 
            className="w-full flex justify-center" 
            type="button"
            onClick={() => window.location.href = 'http://localhost:4000/api/auth/oauth/github'}
          >
            GitHub
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};

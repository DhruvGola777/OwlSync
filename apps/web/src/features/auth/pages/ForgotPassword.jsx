import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { api } from '../../../services/api';
import { AuthLayout } from '../components/AuthLayout';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await api.requestPasswordReset(email);
      setSuccess('If an account exists with that email, a reset link has been sent.');
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {success && (
          <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
            {success}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Send reset link
        </Button>

        <div className="text-center text-sm">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

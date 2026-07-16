import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

// Create an axios instance that automatically sends cookies
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const api = {
  async register(email, password, name) {
    try {
      const res = await apiClient.post('/auth/register', { email, password, name });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  async login(email, password) {
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },
  
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    }
  }
};

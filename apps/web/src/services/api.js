import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

// Create an axios instance that automatically sends cookies
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor to handle silent token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;
      try {
        await apiClient.post('/auth/refresh');
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, they really are logged out
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper to extract the correct message
const extractError = (error, defaultMsg) => {
  return error.response?.data?.message || error.response?.data?.error || defaultMsg;
};

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

  async getMe() {
    try {
      const res = await apiClient.get('/users/me');
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Not authenticated');
    }
  },
  
  async updateProfile(data) {
    try {
      const res = await apiClient.patch('/users/me', data);
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to update profile');
    }
  },

  async deleteAccount() {
    try {
      const res = await apiClient.delete('/users/me');
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete account');
    }
  },

  async getSessions() {
    try {
      const res = await apiClient.get('/users/sessions');
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch sessions');
    }
  },

  async revokeSession(id) {
    try {
      const res = await apiClient.delete(`/users/sessions/${id}`);
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to revoke session');
    }
  },

  async setup2FA() {
    try {
      const res = await apiClient.get('/users/2fa/setup');
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to setup 2FA');
    }
  },

  async verify2FA(token) {
    try {
      const res = await apiClient.post('/users/2fa/verify', { token });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to verify 2FA token');
    }
  },

  async disable2FA() {
    try {
      const res = await apiClient.delete('/users/2fa/disable');
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to disable 2FA');
    }
  },
  
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    }
  },

  async loginTwoFactor(email, token) {
    try {
      const res = await apiClient.post('/auth/2fa/login', { email, token });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || '2FA login failed');
    }
  },

  async requestPasswordReset(email) {
    try {
      const res = await apiClient.post('/auth/password-reset/request', { email });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to request password reset');
    }
  },

  async resetPassword(token, password) {
    try {
      const res = await apiClient.post('/auth/password-reset', { token, password });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to reset password');
    }
  },

  async requestMagicLink(email) {
    try {
      const res = await apiClient.post('/auth/magic-link/request', { email });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to request magic link');
    }
  },

  async verifyMagicLink(token) {
    try {
      const res = await apiClient.get(`/auth/magic-link/verify?token=${token}`);
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Invalid or expired magic link');
    }
  },

  // Workspaces
  async getWorkspaces() {
    try {
      const res = await apiClient.get('/workspaces');
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch workspaces'));
    }
  },

  async createWorkspace(data) {
    try {
      const res = await apiClient.post('/workspaces', data);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to create workspace'));
    }
  },

  // Rooms
  async getRooms() {
    try {
      const res = await apiClient.get('/rooms');
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch rooms'));
    }
  },

  async createRoom(data) {
    try {
      const res = await apiClient.post('/rooms', data);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to create room'));
    }
  },

  async getRoom(id) {
    try {
      const res = await apiClient.get(`/rooms/${id}`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch room'));
    }
  },

  async joinRoom(roomId, password) {
    try {
      const res = await apiClient.post(`/rooms/join`, { roomId, password });
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to join room'));
    }
  },

  async leaveRoom(roomId) {
    try {
      const res = await apiClient.post(`/rooms/${roomId}/leave`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to leave room'));
    }
  },

  async kickMember(roomId, userId) {
    try {
      const res = await apiClient.delete(`/rooms/${roomId}/members/${userId}`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to kick member'));
    }
  },

  async deleteRoom(roomId) {
    try {
      const res = await apiClient.delete(`/rooms/${roomId}`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to delete room'));
    }
  }
};

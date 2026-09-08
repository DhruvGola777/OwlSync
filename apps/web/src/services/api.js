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
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
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

  async searchUsers(query) {
    try {
      const res = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`);
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to search users');
    }
  },

  async getPublicProfile(username) {
    try {
      const res = await apiClient.get(`/users/profile/${encodeURIComponent(username)}`);
      return res.data.profile;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to load profile');
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
  },

  async getRoomMessages(roomId) {
    try {
      const res = await apiClient.get(`/rooms/${roomId}/messages`);
      return res.data.messages || [];
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch room messages'));
    }
  },

  // Projects
  async getProjects() {
    try {
      const res = await apiClient.get(`/projects`);
      return res.data.data.projects;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch projects'));
    }
  },

  async createProject(data) {
    try {
      const res = await apiClient.post(`/projects`, data);
      return res.data.data.project;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to create project'));
    }
  },

  async getProject(projectId) {
    try {
      const res = await apiClient.get(`/projects/${projectId}`);
      return res.data.data.project;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch project'));
    }
  },

  async createFile(projectId, data) {
    try {
      const res = await apiClient.post(`/projects/${projectId}/files`, data);
      return res.data.data.file;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to create file'));
    }
  },

  async updateFile(projectId, fileId, content) {
    try {
      const res = await apiClient.put(`/projects/${projectId}/files/${fileId}`, { content });
      return res.data.data.file;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to update file'));
    }
  },

  async renameFileOrFolder(projectId, oldPath, newPath) {
    try {
      await apiClient.put(`/projects/${projectId}/files/rename`, { oldPath, newPath });
    } catch (error) {
      throw new Error(extractError(error, 'Failed to rename file or folder'));
    }
  },

  async deleteFileOrFolder(projectId, path) {
    try {
      await apiClient.delete(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
    } catch (error) {
      throw new Error(extractError(error, 'Failed to delete file or folder'));
    }
  },

  // Legacy delete for single file by id if still used somewhere
  async deleteFile(projectId, fileId) {
    try {
      await apiClient.delete(`/projects/${projectId}/files/${fileId}`);
    } catch (error) {
      throw new Error(extractError(error, 'Failed to delete file'));
    }
  },

  // Notes API
  async getNote(projectId) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/notes`);
      return res.data.data.note;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch project note'));
    }
  },

  async updateNote(projectId, content) {
    try {
      const res = await apiClient.put(`/projects/${projectId}/notes`, { content });
      return res.data.data.note;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to update project note'));
    }
  },

  // Whiteboard API
  async getWhiteboard(projectId) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/whiteboard`);
      return res.data.data.whiteboard;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch project whiteboard'));
    }
  },

  async updateWhiteboard(projectId, state) {
    try {
      const res = await apiClient.put(`/projects/${projectId}/whiteboard`, { state });
      return res.data.data.whiteboard;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to update project whiteboard'));
    }
  },

  // Activities API
  async getActivities(projectId) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/activities`);
      return res.data.data.activities;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch activities'));
    }
  },

  async createActivity(projectId, data) {
    try {
      const res = await apiClient.post(`/projects/${projectId}/activities`, data);
      return res.data.data.activity;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to log activity'));
    }
  },

  // Friends API
  async getFriends() {
    try {
      const res = await apiClient.get('/friends');
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch friends'));
    }
  },

  async getFriendRequests() {
    try {
      const res = await apiClient.get('/friends/requests');
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to fetch friend requests'));
    }
  },

  async sendFriendRequest(username) {
    try {
      const res = await apiClient.post('/friends/request', { username });
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to send friend request'));
    }
  },

  async acceptFriendRequest(requestId) {
    try {
      const res = await apiClient.post(`/friends/${requestId}/accept`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to accept friend request'));
    }
  },

  async declineFriendRequest(requestId) {
    try {
      const res = await apiClient.post(`/friends/${requestId}/decline`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to decline friend request'));
    }
  },

  async blockUser(userId) {
    try {
      const res = await apiClient.post(`/users/${userId}/block`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to block user'));
    }
  },

  async unblockUser(userId) {
    try {
      const res = await apiClient.delete(`/users/${userId}/block`);
      return res.data;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to unblock user'));
    }
  },

  // AI Assistant APIs
  async aiChat(data) {
    try {
      const res = await apiClient.post('/ai/chat', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to get AI response'));
    }
  },

  async aiExplain(data) {
    try {
      const res = await apiClient.post('/ai/explain', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to explain code'));
    }
  },

  async aiRefactor(data) {
    try {
      const res = await apiClient.post('/ai/refactor', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to refactor code'));
    }
  },

  async aiGenerateTests(data) {
    try {
      const res = await apiClient.post('/ai/generate-tests', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to generate tests'));
    }
  },

  async aiDetectBugs(data) {
    try {
      const res = await apiClient.post('/ai/detect-bugs', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to detect bugs'));
    }
  },

  async aiSummarizeSession(data) {
    try {
      const res = await apiClient.post('/ai/summarize-session', data);
      return res.data.data.response;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to summarize session'));
    }
  },

  async generateCommitMessage({ files = [], diffSummary = '' }) {
    try {
      const res = await apiClient.post('/ai/commit-message', { files, diffSummary });
      return res.data.data.commitMessage;
    } catch (error) {
      throw new Error(extractError(error, 'Failed to generate commit message'));
    }
  },

  async streamAgentSession({
    projectId,
    prompt,
    activeFile,
    selectedCode,
    contextFiles = [],
    history = [],
    onEvent,
    onError,
    onComplete
  }) {
    try {
      const response = await fetch(`${API_URL}/ai/agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          prompt,
          activeFile,
          selectedCode,
          contextFiles,
          history
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to start agent stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.replace(/^data: /, '');

          if (dataStr === '[DONE]') {
            onComplete?.();
            return;
          }

          try {
            const event = JSON.parse(dataStr);
            onEvent?.(event);
          } catch (e) {
            console.error('Failed to parse SSE event:', dataStr, e);
          }
        }
      }
      onComplete?.();
    } catch (err) {
      console.error('Agent stream error:', err);
      onError?.(err);
    }
  }
};

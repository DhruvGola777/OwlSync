export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OwlSync API Documentation',
    version: '1.0.0',
    description: 'Production REST API for real-time collaborative coding, AI pair programming, workspace management, and system telemetry.',
    contact: {
      name: 'OwlSync Engineering Team',
      url: 'https://github.com/DhruvGola777/OwlSync'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token: Bearer <token>'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'HTTP-only authentication cookie'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          username: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
          twoFactorEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      File: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          path: { type: 'string', example: '/src/App.jsx' },
          content: { type: 'string' },
          projectId: { type: 'string', format: 'uuid' }
        }
      },
      Room: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          code: { type: 'string' },
          hasPassword: { type: 'boolean' },
          ownerId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' }
        }
      },
      Recording: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          url: { type: 'string' },
          thumbnailUrl: { type: 'string', nullable: true },
          duration: { type: 'integer', example: 120 },
          size: { type: 'integer', example: 5242880 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AnalyticsSummary: {
        type: 'object',
        properties: {
          totals: {
            type: 'object',
            properties: {
              FILE_SAVE: { type: 'integer', example: 45 },
              AI_QUERY: { type: 'integer', example: 12 },
              RECORDING_UPLOAD: { type: 'integer', example: 3 },
              EXPORT_ZIP: { type: 'integer', example: 5 },
              TOTAL_EVENTS: { type: 'integer', example: 65 }
            }
          },
          recentEvents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                eventType: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Detailed error message' }
        }
      }
    }
  },
  security: [
    { bearerAuth: [] }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health & Monitoring'],
        summary: 'Deep infrastructure health check',
        description: 'Probes PostgreSQL, Redis, and RabbitMQ with latency measurements and memory diagnostics.',
        security: [],
        responses: {
          200: {
            description: 'All services are operational (healthy)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    uptimeSeconds: { type: 'integer', example: 340 },
                    services: {
                      type: 'object',
                      properties: {
                        postgres: { type: 'object', properties: { status: { type: 'string', example: 'up' }, latencyMs: { type: 'integer', example: 2 } } },
                        redis: { type: 'object', properties: { status: { type: 'string', example: 'up' }, latencyMs: { type: 'integer', example: 1 } } },
                        rabbitmq: { type: 'object', properties: { status: { type: 'string', example: 'up' }, latencyMs: { type: 'integer', example: 1 } } }
                      }
                    }
                  }
                }
              }
            }
          },
          503: {
            description: 'One or more background services are degraded or down'
          }
        }
      }
    },
    '/health/ready': {
      get: {
        tags: ['Health & Monitoring'],
        summary: 'Readiness probe for load balancers and container orchestrators',
        security: [],
        responses: {
          200: { description: 'API is ready to receive traffic' },
          503: { description: 'API dependencies not ready' }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['Health & Monitoring'],
        summary: 'Prometheus metrics feed',
        description: 'Returns Prometheus exposition format metrics for scraping.',
        security: [],
        responses: {
          200: {
            description: 'Prometheus metrics stream',
            content: {
              'text/plain': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new developer account',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name', 'username'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'dev@owlsync.com' },
                  password: { type: 'string', format: 'password', example: 'SecretPassword123' },
                  name: { type: 'string', example: 'Alex Morgan' },
                  username: { type: 'string', example: 'alexm' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Account successfully registered and authenticated' },
          400: { description: 'Validation error or email already in use' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and receive JWT session cookie',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'dev@owlsync.com' },
                  password: { type: 'string', format: 'password', example: 'SecretPassword123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Successfully authenticated' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout and clear authentication cookies',
        responses: {
          200: { description: 'Successfully logged out' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get currently authenticated user',
        responses: {
          200: {
            description: 'Authenticated user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          401: { description: 'Not authenticated' }
        }
      }
    },
    '/api/projects': {
      get: {
        tags: ['Projects & Codebases'],
        summary: 'Get all projects for current user',
        responses: {
          200: {
            description: 'List of user projects',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Projects & Codebases'],
        summary: 'Create a new project',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Fullstack SaaS App' },
                  description: { type: 'string', example: 'React + Node project workspace' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Project created successfully' }
        }
      }
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Projects & Codebases'],
        summary: 'Get project details and full file tree (Redis Cache-Aside)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project with file tree' },
          404: { description: 'Project not found' }
        }
      }
    },
    '/api/projects/{id}/files': {
      post: {
        tags: ['Projects & Codebases'],
        summary: 'Create a new file in project (Protected by Redis Distributed Lock)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'path'],
                properties: {
                  name: { type: 'string', example: 'App.jsx' },
                  path: { type: 'string', example: '/src/App.jsx' },
                  content: { type: 'string', example: 'export default function App() { return <h1>Hello</h1>; }' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'File created and telemetry published' },
          400: { description: 'File path already exists' }
        }
      }
    },
    '/api/projects/{id}/export': {
      get: {
        tags: ['Projects & Codebases'],
        summary: 'Export and download project codebase as compressed ZIP archive',
        description: 'Streams a level-9 compressed ZIP archive and dispatches background worker task.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'Compressed ZIP file download',
            content: {
              'application/zip': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      }
    },
    '/api/rooms': {
      get: {
        tags: ['Rooms & Collaboration'],
        summary: 'Get all accessible collaboration rooms',
        responses: {
          200: { description: 'List of rooms' }
        }
      },
      post: {
        tags: ['Rooms & Collaboration'],
        summary: 'Create a new collaborative coding room',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'projectId'],
                properties: {
                  name: { type: 'string', example: 'React Pair Programming Room' },
                  projectId: { type: 'string', format: 'uuid' },
                  password: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Room created' }
        }
      }
    },
    '/api/ai/chat': {
      post: {
        tags: ['AI Pair Programmer'],
        summary: 'Ask the AI Pair Programmer a question or code request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'How can I optimize this MongoDB query into PostgreSQL?' },
                  activeFile: { type: 'string', example: '/src/server.js' },
                  selection: { type: 'string', example: 'const user = await db.find()' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'AI Assistant Response' }
        }
      }
    },
    '/api/recordings': {
      get: {
        tags: ['Session Recordings'],
        summary: 'Get all user coding session screen/audio recordings',
        responses: {
          200: {
            description: 'List of recordings with generated video thumbnails',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        recordings: { type: 'array', items: { $ref: '#/components/schemas/Recording' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Session Recordings'],
        summary: 'Upload a session recording (Triggers RabbitMQ FFmpeg Thumbnail Worker)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['recording'],
                properties: {
                  recording: { type: 'string', format: 'binary' },
                  title: { type: 'string', example: 'React Pair Coding Session' },
                  duration: { type: 'integer', example: 180 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Recording uploaded and thumbnail job queued' }
        }
      }
    },
    '/api/analytics/user/summary': {
      get: {
        tags: ['Analytics & Telemetry'],
        summary: 'Get real-time developer activity metrics (Redis Powered)',
        responses: {
          200: {
            description: 'User aggregate metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        analytics: { $ref: '#/components/schemas/AnalyticsSummary' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

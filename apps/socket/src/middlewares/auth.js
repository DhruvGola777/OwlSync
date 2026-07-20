import jwt from 'jsonwebtoken';

export const requireSocketAuth = (socket, next) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_development';
    let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, ...rest] = cookie.trim().split('=');
        acc[key] = rest.join('=');
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      console.error('Socket Auth Error: No token provided in handshake or cookies.');
      console.error('Handshake:', socket.handshake.headers);
      return next(new Error('Authentication error: Token not provided'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    console.log(`Socket authenticated for user: ${decoded.userId}`);
    next();
  } catch (error) {
    console.error('Socket Auth Error: Invalid token.', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

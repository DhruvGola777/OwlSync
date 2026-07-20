import React from 'react';
import Avatar, { genConfig } from 'react-nice-avatar';

export default function AvatarDisplay({ avatarUrl, name, size = 40, style = {} }) {
  // If no avatarUrl is provided, generate an initials avatar using ui-avatars.com
  const getInitialsAvatar = () => {
    const defaultName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random&color=fff`;
  };

  if (!avatarUrl) {
    return (
      <img
        src={getInitialsAvatar()}
        alt={`${name || 'User'} Avatar`}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
      />
    );
  }

  // Check if avatarUrl is a JSON string (meaning it's a react-nice-avatar config)
  let avatarConfig = null;
  try {
    avatarConfig = JSON.parse(avatarUrl);
  } catch (e) {
    // If it's not JSON, it's likely a regular image URL
    avatarConfig = null;
  }

  if (avatarConfig && typeof avatarConfig === 'object') {
    // It's a react-nice-avatar configuration
    return (
      <Avatar
        style={{ width: size, height: size, ...style }}
        {...avatarConfig}
      />
    );
  }

  // Fallback to standard image rendering if it's just a URL string
  return (
    <img
      src={avatarUrl}
      alt={`${name || 'User'} Avatar`}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
      onError={(e) => {
        // If image fails to load, fallback to initials
        e.target.onerror = null;
        e.target.src = getInitialsAvatar();
      }}
    />
  );
}

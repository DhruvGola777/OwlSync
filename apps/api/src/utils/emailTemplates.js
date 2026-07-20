export const getRegistrationEmailHtml = (name, link) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #eaeaea;">
    <div style="background-color: #4f46e5; padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">OwlSync</h1>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Welcome to OwlSync, ${name || 'there'}! 👋</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 32px;">
        We're thrilled to have you! To get started and unlock full access to your new workspace, please verify your email address by clicking the button below.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${link}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 28px; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Verify Email Address</a>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 0;">
        Or copy and paste this link into your browser:<br>
        <a href="${link}" style="color: #4f46e5; text-decoration: underline; word-break: break-all;">${link}</a>
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #eaeaea;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        &copy; ${new Date().getFullYear()} OwlSync Inc. All rights reserved.<br>
        You're receiving this because you signed up for an OwlSync account.
      </p>
    </div>
  </div>
`;

export const getOAuthWelcomeEmailHtml = (name, provider) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #eaeaea;">
    <div style="background-color: #4f46e5; padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">OwlSync</h1>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Welcome aboard, ${name || 'there'}! 👋</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
        We're absolutely thrilled to have you join OwlSync. You've successfully connected your <strong>${provider.charAt(0).toUpperCase() + provider.slice(1)}</strong> account, which means you're all set to start organizing your workspaces and projects like a pro.
      </p>
      <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
        If you have any questions or need a hand getting started, simply reply to this email. We're here to help!
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #eaeaea;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        &copy; ${new Date().getFullYear()} OwlSync Inc. All rights reserved.<br>
        123 Workflow Ave, San Francisco, CA 94107
      </p>
    </div>
  </div>
`;

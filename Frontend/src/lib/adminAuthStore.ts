/**
 * Stores and manages dynamic Master Administrator credentials and OTP utilities.
 * Defaults to info@acudigiverse.com / Apple9844? and allows admin to customize in Settings.
 */

export const DEFAULT_ADMIN_EMAIL = 'info@acudigiverse.com';
export const DEFAULT_ADMIN_PASSWORD = 'Apple9844?';

const STORAGE_KEY_ADMIN_EMAIL = 'admin_email_configured';
const STORAGE_KEY_ADMIN_PASSWORD = 'admin_password_configured';

export const adminAuthStore = {
  /**
   * Retrieves current admin email (customized from Settings or default).
   */
  getAdminEmail(): string {
    if (typeof window === 'undefined') return DEFAULT_ADMIN_EMAIL;
    return localStorage.getItem(STORAGE_KEY_ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;
  },

  /**
   * Retrieves current admin password (customized from Settings or default).
   */
  getAdminPassword(): string {
    if (typeof window === 'undefined') return DEFAULT_ADMIN_PASSWORD;
    return localStorage.getItem(STORAGE_KEY_ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
  },

  /**
   * Updates admin email and/or password. Persists across browser sessions.
   */
  setAdminCredentials(credentials: { email?: string; password?: string }): void {
    if (typeof window === 'undefined') return;
    if (credentials.email) {
      localStorage.setItem(STORAGE_KEY_ADMIN_EMAIL, credentials.email.trim().toLowerCase());
    }
    if (credentials.password) {
      localStorage.setItem(STORAGE_KEY_ADMIN_PASSWORD, credentials.password);
    }
  },

  /**
   * Resets admin credentials to initial system defaults.
   */
  resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY_ADMIN_EMAIL);
    localStorage.removeItem(STORAGE_KEY_ADMIN_PASSWORD);
  },

  /**
   * Generates a realistic mock 4-digit numeric OTP (e.g. 1000 - 9999).
   */
  generateMockOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  },
};

// src/lib/auth.ts
import { jwtDecode } from 'jwt-decode';

// Define the shape of the decoded token payload
interface JwtPayload {
  id: string;
  username: string;
  iat: number;
  exp: number; // 'exp' is the expiration timestamp
}

/**
 * Saves the authentication token to local storage.
 * @param token The JWT token string.
 */
export const saveAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

/**
 * Retrieves the authentication token from local storage.
 * @returns The JWT token string or null if it doesn't exist.
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

/**
 * Removes the authentication token from local storage.
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

/**
 * Checks if a user is currently authenticated and the token is not expired.
 * @returns True if a valid, non-expired token exists, false otherwise.
 */
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();

  if (!token) {
    // No token exists
    return false;
  }

  try {
    // Decode the token to get its payload
    const decodedToken = jwtDecode<JwtPayload>(token);

    // 'exp' is in seconds, Date.now() is in milliseconds
    const isExpired = decodedToken.exp * 1000 < Date.now();

    if (isExpired) {
      // Token is expired, remove it
      removeAuthToken();
      return false;
    }

    // Token exists and is not expired
    return true;

  } catch (error) {
    // Token is malformed or invalid
    console.error('Invalid token:', error);
    removeAuthToken();
    return false;
  }
};
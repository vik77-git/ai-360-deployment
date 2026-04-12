import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  register: (email: string, name: string, password: string) => boolean;
  logout: () => void;
  resetPassword: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("nexus_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = (email: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem("nexus_users") || "{}");
    const u = users[email];
    if (u && u.password === password) {
      const userData = { email, name: u.name };
      setUser(userData);
      localStorage.setItem("nexus_user", JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const register = (email: string, name: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem("nexus_users") || "{}");
    if (users[email]) return false;
    users[email] = { name, password };
    localStorage.setItem("nexus_users", JSON.stringify(users));
    const userData = { email, name };
    setUser(userData);
    localStorage.setItem("nexus_user", JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("nexus_user");
  };

  const resetPassword = (email: string): boolean => {
    const users = JSON.parse(localStorage.getItem("nexus_users") || "{}");
    return !!users[email];
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

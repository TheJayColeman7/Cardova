import { useEffect, useState } from "react";

const KEY = "shc-auth";
const EVENT = "shc-auth-change";

export function getUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getUser());
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function login(name) {
  const trimmed = String(name || "").trim();
  const user = { name: trimmed || "Collector" };
  localStorage.setItem(KEY, JSON.stringify(user));
  notify();
  return user;
}

export function logout() {
  localStorage.removeItem(KEY);
  notify();
}

export function subscribeAuth(callback) {
  const handler = () => callback(getUser());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useAuth() {
  const [user, setUser] = useState(getUser);
  useEffect(() => subscribeAuth(setUser), []);
  return { user, loggedIn: Boolean(user) };
}

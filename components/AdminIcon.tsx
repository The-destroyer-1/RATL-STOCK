"use client";

import React from "react";

export default function AdminIcon({ className }: { className?: string }) {
  return (
    <a
      href="/admin"
      className={className ? `admin-icon ${className}` : "admin-icon"}
      aria-label="Admin login"
      title="Admin login"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    </a>
  );
}

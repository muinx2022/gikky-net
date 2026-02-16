"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const DashboardShell = dynamic(() => import('./DashboardShell'), {
  ssr: false,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
        {children}
    </DashboardShell>
  );
}

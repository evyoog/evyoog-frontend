import { useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import SessionTimeoutWarning from '../SessionTimeoutWarning';

interface AppLayoutProps {
  breadcrumb: string;
  children: ReactNode;
}

export default function AppLayout({ breadcrumb, children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-offwhite">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          breadcrumb={breadcrumb}
          onMenuClick={() => setIsMobileMenuOpen((open) => !open)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
      <SessionTimeoutWarning />
    </div>
  );
}

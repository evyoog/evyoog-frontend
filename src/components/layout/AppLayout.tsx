import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppLayoutProps {
  breadcrumb: string;
  children: ReactNode;
}

export default function AppLayout({ breadcrumb, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-offwhite">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar breadcrumb={breadcrumb} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin Dashboard - RankMyBrand',
  description: 'AI Visibility System Monitoring and Administration',
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  // In production, add authentication check here
  // const session = await getServerSession();
  // if (!session?.user?.isAdmin) {
  //   redirect('/login');
  // }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
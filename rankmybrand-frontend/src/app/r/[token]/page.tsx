import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function SignedLinkPage({ params }: PageProps) {
  const { token } = params;
  
  // Validate token server-side
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
    const response = await fetch(`${apiUrl}/api/report/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward user agent for logging
        'User-Agent': headers().get('user-agent') || '',
      },
      body: JSON.stringify({ token }),
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
      
      // Redirect to dashboard with report params
      // Using View Transitions API via client component would require additional wrapper
      // For SSR, we use standard redirect with query params
      const dashboardUrl = new URL(process.env.DASHBOARD_URL || 'http://localhost:3000');
      dashboardUrl.searchParams.set('report', data.reportId);
      dashboardUrl.searchParams.set('from', 'email');
      if (data.companyId) {
        dashboardUrl.searchParams.set('company', data.companyId);
      }
      
      redirect(dashboardUrl.toString());
    } else {
      // Invalid or expired token
      redirect('/login?error=invalid_token');
    }
  } catch (error) {
    console.error('Token validation error:', error);
    redirect('/login?error=token_error');
  }
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
  return {
    title: 'Opening your dashboard...',
    robots: 'noindex, nofollow', // Don't index these temporary links
  };
}
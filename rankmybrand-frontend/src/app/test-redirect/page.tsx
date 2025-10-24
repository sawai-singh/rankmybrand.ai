'use client';

export default function TestRedirect() {
  const handleRedirect = () => {
    console.log('Redirecting to dashboard on port 3000...');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    window.location.href = `${appUrl}/dashboard?onboarding=complete`;
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Test Redirect</h1>
      <button 
        onClick={handleRedirect}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Redirect to Dashboard (Port 3000)
      </button>
    </div>
  );
}
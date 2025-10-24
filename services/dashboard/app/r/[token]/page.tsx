"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function TokenRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<'validating' | 'redirecting' | 'error'>('validating');
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:4000";

  useEffect(() => {
    if (!token) {
      setError("Invalid link - no token provided");
      setStatus('error');
      return;
    }

    validateAndRedirect();
  }, [token]);

  const validateAndRedirect = async () => {
    try {
      setStatus('validating');

      // Verify token is valid
      const response = await fetch(`${API_BASE}/api/reports/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify token");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Invalid or expired link");
      }

      // Token is valid - redirect to the full dashboard
      setStatus('redirecting');

      // Build the redirect URL to rankmybrand-frontend dashboard
      const dashboardUrl = `http://localhost:3000/dashboard/ai-visibility?token=${token}&auditId=${result.auditId}`;

      // Redirect after a brief moment
      setTimeout(() => {
        window.location.href = dashboardUrl;
      }, 800);

    } catch (err: any) {
      console.error("Token validation error:", err);
      setError(err.message || "Failed to validate token");
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full"
      >
        {status === 'validating' && (
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <motion.div
                className="absolute inset-0 border-4 border-purple-500/30 rounded-full"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Validating Access
              </h1>
              <p className="text-gray-400 text-sm">
                Verifying your secure link...
              </p>
            </div>
          </div>
        )}

        {status === 'redirecting' && (
          <div className="text-center space-y-6">
            <motion.div
              className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </motion.div>

            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Access Granted
              </h1>
              <p className="text-gray-400 text-sm">
                Redirecting to your dashboard...
              </p>
            </div>

            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Unable to Access
              </h1>
              <p className="text-gray-400 text-sm mb-4">
                {error}
              </p>
              <p className="text-gray-500 text-xs">
                This link may have expired or is invalid. Please request a new link.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

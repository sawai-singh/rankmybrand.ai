export default function GeneratingLoading() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
      
      {/* Skeleton content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          {/* Progress skeleton */}
          <div className="mb-8 flex items-center justify-center space-x-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
                {i < 3 && <div className="w-12 h-0.5 bg-white/5 ml-2" />}
              </div>
            ))}
          </div>
          
          {/* Card skeleton */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12">
            {/* Icon skeleton */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
            </div>
            
            {/* Text skeleton */}
            <div className="space-y-4 mb-8">
              <div className="h-8 bg-white/5 rounded-lg animate-pulse mx-auto max-w-sm" />
              <div className="h-4 bg-white/5 rounded animate-pulse mx-auto max-w-xs" />
            </div>
            
            {/* List skeleton */}
            <div className="space-y-4 mb-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded animate-pulse w-32" />
                    <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Button skeleton */}
            <div className="flex gap-4">
              <div className="flex-1 h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="flex-1 h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
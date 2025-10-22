import { useQuery } from '@tanstack/react-query';

interface VersionInfo {
  version: string;
  gitCommit: string;
  buildDate: string;
}

export function AppVersion() {
  const { data } = useQuery<VersionInfo>({
    queryKey: ['/api/version'],
    refetchInterval: 30000, // Refresh every 30 seconds to detect new deploys
    retry: false,
  });

  if (!data) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 text-sm text-foreground/70 font-mono z-50 pointer-events-none select-none bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-lg border border-border/50"
      data-testid="text-app-version"
      title={`Build date: ${new Date(data.buildDate).toLocaleString()}`}
    >
      v{data.version} ({data.gitCommit})
    </div>
  );
}

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
      className="fixed bottom-2 right-2 text-xs text-muted-foreground/50 font-mono z-50 pointer-events-none select-none"
      data-testid="text-app-version"
      title={`Build date: ${new Date(data.buildDate).toLocaleString()}`}
    >
      v{data.version} ({data.gitCommit})
    </div>
  );
}

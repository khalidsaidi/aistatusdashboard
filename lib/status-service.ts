import { PROVIDERS } from './providers';

export interface ProviderStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  lastChecked: string;
  error?: string;
}

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const results = await Promise.allSettled(
    PROVIDERS.map(async (provider) => {
      const startTime = Date.now();
      
      try {
        const response = await fetch(provider.statusUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'AI-Status-Dashboard/1.0',
            'Accept': 'application/json,text/html,*/*',
          },
          signal: AbortSignal.timeout(10000)
        });
        
        const responseTime = Date.now() - startTime;
        
        let status: 'operational' | 'degraded' | 'down' | 'unknown' = 'unknown';
        
        if (response.ok) {
          try {
            const data = await response.json();
            
            // Parse different status page formats
            if (data.status?.indicator) {
              const indicator = data.status.indicator;
              status = indicator === 'none' ? 'operational' :
                       indicator === 'minor' ? 'degraded' :
                       indicator === 'major' || indicator === 'critical' ? 'down' :
                       'operational';
            } else if (Array.isArray(data)) {
              // Google AI format - check for active incidents
              const hasActiveIncidents = data.some(incident => 
                !incident.end && incident.status_impact
              );
              status = hasActiveIncidents ? 'degraded' : 'operational';
            } else {
              status = 'operational';
            }
          } catch {
            // If JSON parsing fails but response is OK, assume operational
            status = 'operational';
          }
        } else {
          status = 'down';
        }
        
        return {
          id: provider.id,
          name: provider.name,
          status,
          responseTime,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        return {
          id: provider.id,
          name: provider.name,
          status: 'unknown' as const,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : {
      id: 'unknown',
      name: 'Unknown Provider',
      status: 'unknown' as const,
      responseTime: 0,
      lastChecked: new Date().toISOString(),
      error: 'Failed to check status'
    }
  );
} 
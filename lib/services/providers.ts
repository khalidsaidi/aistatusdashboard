import { Provider } from '@/lib/types';
import providersConfig from '@/lib/data/providers.json';

class ProviderService {
    private providers: Provider[];

    constructor() {
        this.providers = (providersConfig.providers as Provider[]).filter(
            (p) => p.enabled !== false
        );
    }

    getProviders(): Provider[] {
        return this.providers;
    }

    getProvider(id: string): Provider | undefined {
        return this.providers.find((p) => p.id === id);
    }

    getProvidersByCategory(category: string): Provider[] {
        return this.providers.filter((p) => p.category === category);
    }

    getCategories(): string[] {
        return Array.from(new Set(this.providers.map((p) => p.category))).sort();
    }
}

export const providerService = new ProviderService();

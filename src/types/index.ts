export type StatusCategory = 'not-started' | 'started' | 'done';

export interface Issue {
    key: string;
    fields: {
        created: string;
        resolutiondate?: string | null;
        status: {
            name: string;
        };
        [key: string]: any;
    };
    changelog?: {
        histories: {
            created: string;
            items: {
                field: string;
                fromString: string;
                toString: string;
                from?: string;
                to?: string;
            }[];
        }[];
    };
}

export interface StatusConfig {
    name: string;
    color: string;
    enabled: boolean;
    category: StatusCategory;
}

export interface ForecastConfig {
    enabled: boolean;
    avgDatapoints: number;
    showConfidence: boolean;
    mcCycles?: number;
}

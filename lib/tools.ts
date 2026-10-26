export interface JobMatch {
  id: string;
  title: string;
  company: string;
  matchScore: number;
  matchedRequirements: string[];
  missingRequirements: string[];
  applyUrl: string;
  sourceLabel: string;
}

export interface JobRadarResponse {
  profile: {
    skills: string[];
    experience: string;
    education: string;
  };
  jobs: JobMatch[];
}

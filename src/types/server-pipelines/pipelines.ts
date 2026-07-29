export type SourceResult = {
  data: string;
  metadata?: Record<string, unknown>;
};

export type DataSource = {
  name: string;
  description: string;
  fetch: (courseCode: string, term: string) => Promise<SourceResult>;
};

export type PipelineStepRequest = {
  courseCode: string;
  term: string;
  step: 'planets' | 'ai';
  htmlData?: string;
  userContext?: string;
};

export type PipelineStepResult = {
  step: ProcessingStep;
  data?: unknown;
};

type ProcessingStep = {
  id: string;
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  code?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  data?: unknown;
};

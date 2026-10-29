export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'time'
  | 'datetime'
  | 'single_choice'
  | 'multiple_choice'
  | 'rating_5'
  | 'likert_5'
  | 'section_heading';

export interface ChoiceOption {
  id: string;
  code: string;
  label: string;
  score?: number;
}

export interface QuestionValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regexPattern?: string;
  customErrorMessage?: string;
}

export type LogicOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionalRule {
  targetQuestionId: string;
  operator: LogicOperator;
  value?: string | number | string[];
}

export interface ConditionalLogic {
  action: 'show' | 'hide';
  match: 'all' | 'any';
  rules: ConditionalRule[];
}

export interface QuestionItem {
  id: string;
  variableName: string;
  type: QuestionType;
  text: string;
  description?: string;
  explanation?: string;
  remark?: string;
  sectionId?: string;
  order: number;
  validation: QuestionValidationRules;
  choices?: ChoiceOption[];
  conditionalLogic?: ConditionalLogic;
  isAiGenerated?: boolean;
  verifiedByResearcher?: boolean;
  targetObjectiveId?: string;
  targetOutcomeName?: string;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export type QuestionnaireStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'published'
  | 'archived';

export interface ObjectiveOutcomeMapping {
  objectiveId: string;
  objectiveTitle: string;
  outcomeName: string;
  coveredQuestionIds: string[];
  isCovered: boolean;
  coverageNotes?: string;
}

export interface QuestionnaireVersionItem {
  id: string;
  questionnaireId: string;
  versionNumber: string;
  status: QuestionnaireStatus;
  publishedAt?: string;
  publishedBy?: string;
  changeSummary?: string;
  questionCount: number;
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  studyId?: string;
  studyTitle?: string;
  protocolId?: string;
  version: string;
  status: QuestionnaireStatus;
  isAiGenerated?: boolean;
  scientificValidationClaim?: string;
  sections: QuestionnaireSection[];
  questions: QuestionItem[];
  mappings?: ObjectiveOutcomeMapping[];
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface AiGenerateQuestionnairePayload {
  studyTitle: string;
  protocolId?: string;
  studyId?: string;
  researchAims: string;
  targetPopulation: string;
  outcomes: string[];
  instrumentType?: 'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic';
  suggestedQuestionCount?: number;
}

export interface QuestionnaireMetricItem {
  id: string;
  studyId: string;
  title: string;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  averageTimeToCompleteMinutes?: number;
  status: 'active' | 'draft' | 'closed';
  lastResponseAt?: string;
}

export interface QuestionnaireMetrics {
  totalQuestionnaires: number;
  totalResponses: number;
  averageCompletionRate: number;
  recentQuestionnaires: QuestionnaireMetricItem[];
}

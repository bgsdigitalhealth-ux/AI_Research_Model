import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import ConfigDict, Field, field_validator, model_validator
from app.schemas.common import BaseSchema

QuestionType = Literal[
    "short_text",
    "long_text",
    "integer",
    "decimal",
    "date",
    "time",
    "datetime",
    "single_choice",
    "multiple_choice",
    "rating_5",
    "likert_5",
    "section_heading",
]

LogicOperator = Literal[
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
    "is_empty",
    "is_not_empty",
]

QuestionnaireStatus = Literal[
    "draft",
    "under_review",
    "approved",
    "published",
    "archived",
]


class ChoiceOptionSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    code: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=255)
    score: Optional[float] = None


class QuestionValidationRulesSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    required: Optional[bool] = False
    min: Optional[float] = None
    max: Optional[float] = None
    min_length: Optional[int] = Field(None, alias="minLength")
    max_length: Optional[int] = Field(None, alias="maxLength")
    regex_pattern: Optional[str] = Field(None, alias="regexPattern")
    custom_error_message: Optional[str] = Field(None, alias="customErrorMessage")

    @model_validator(mode="after")
    def validate_numeric_and_length_ranges(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError(f"Numeric validation rule 'min' ({self.min}) cannot exceed 'max' ({self.max}).")
        if self.min_length is not None and self.max_length is not None and self.min_length > self.max_length:
            raise ValueError(
                f"Text length rule 'minLength' ({self.min_length}) cannot exceed 'maxLength' ({self.max_length})."
            )
        return self


class ConditionalRuleSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    target_question_id: str = Field(..., alias="targetQuestionId")
    operator: LogicOperator
    value: Optional[Union[str, float, int, List[str]]] = None


class ConditionalLogicSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    action: Literal["show", "hide"] = "show"
    match: Literal["all", "any"] = "all"
    rules: List[ConditionalRuleSchema] = Field(default_factory=list)


class QuestionItemSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    variable_name: str = Field(..., min_length=1, max_length=100, alias="variableName")
    type: QuestionType
    text: str = Field(..., min_length=1)
    description: Optional[str] = None
    explanation: Optional[str] = None
    remark: Optional[str] = None
    section_id: Optional[str] = Field(None, alias="sectionId")
    order: int = 0
    validation: QuestionValidationRulesSchema = Field(default_factory=QuestionValidationRulesSchema)
    choices: Optional[List[ChoiceOptionSchema]] = None
    conditional_logic: Optional[ConditionalLogicSchema] = Field(None, alias="conditionalLogic")
    is_ai_generated: bool = Field(False, alias="isAiGenerated")
    verified_by_researcher: bool = Field(False, alias="verifiedByResearcher")
    target_objective_id: Optional[str] = Field(None, alias="targetObjectiveId")
    target_outcome_name: Optional[str] = Field(None, alias="targetOutcomeName")

    @field_validator("variable_name")
    def validate_variable_name(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", clean):
            raise ValueError(
                f"Variable name '{clean}' is invalid. Must start with a letter or underscore and contain only alphanumeric characters."
            )
        return clean

    @model_validator(mode="after")
    def validate_question_type_constraints(self):
        choice_types = ("single_choice", "multiple_choice", "rating_5", "likert_5")
        if self.type in choice_types:
            if not self.choices or len(self.choices) == 0:
                # If rating_5 or likert_5 without explicit choices, we can populate default choices
                if self.type == "rating_5":
                    self.choices = [
                        ChoiceOptionSchema(code=str(i), label=f"{i} Stars", score=float(i))
                        for i in range(1, 6)
                    ]
                elif self.type == "likert_5":
                    likert_labels = [
                        (1, "Strongly Disagree"),
                        (2, "Disagree"),
                        (3, "Neutral"),
                        (4, "Agree"),
                        (5, "Strongly Agree"),
                    ]
                    self.choices = [
                        ChoiceOptionSchema(code=str(c), label=lbl, score=float(c))
                        for c, lbl in likert_labels
                    ]
                else:
                    raise ValueError(f"Question type '{self.type}' requires configured response choices.")

            # Validate unique codes within choices
            codes = [c.code for c in self.choices]
            if len(codes) != len(set(codes)):
                raise ValueError(f"Duplicate choice code detected for question '{self.variable_name}'.")

        return self


class QuestionnaireSectionSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    order: int = 0


class ObjectiveOutcomeMappingSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    objective_id: str = Field(..., alias="objectiveId")
    objective_title: str = Field(..., alias="objectiveTitle")
    outcome_name: str = Field(..., alias="outcomeName")
    covered_question_ids: List[str] = Field(default_factory=list, alias="coveredQuestionIds")
    is_covered: bool = Field(False, alias="isCovered")
    coverage_notes: Optional[str] = Field(None, alias="coverageNotes")


class QuestionnaireCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=3, max_length=255)
    study_id: uuid.UUID = Field(..., alias="studyId")
    protocol_id: Optional[uuid.UUID] = Field(None, alias="protocolId")
    description: Optional[str] = None
    sections: List[QuestionnaireSectionSchema] = Field(default_factory=list)
    questions: List[QuestionItemSchema] = Field(default_factory=list)


class QuestionnaireUpdateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    status: Optional[QuestionnaireStatus] = None
    sections: Optional[List[QuestionnaireSectionSchema]] = None
    questions: Optional[List[QuestionItemSchema]] = None
    mappings: Optional[List[ObjectiveOutcomeMappingSchema]] = None


class QuestionnaireResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    protocol_id: Optional[uuid.UUID] = Field(None, alias="protocolId")
    version: str
    status: QuestionnaireStatus
    is_ai_generated: bool = Field(False, alias="isAiGenerated")
    scientific_validation_claim: Optional[str] = Field(None, alias="scientificValidationClaim")
    sections: List[QuestionnaireSectionSchema] = Field(default_factory=list)
    questions: List[QuestionItemSchema] = Field(default_factory=list)
    mappings: Optional[List[ObjectiveOutcomeMappingSchema]] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    approved_by: Optional[str] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    published_at: Optional[datetime] = Field(None, alias="publishedAt")
    published_by: Optional[str] = Field(None, alias="publishedBy")


class QuestionnaireVersionItemResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    questionnaire_id: uuid.UUID = Field(..., alias="questionnaireId")
    version_number: str = Field(..., alias="versionNumber")
    status: QuestionnaireStatus
    published_at: Optional[datetime] = Field(None, alias="publishedAt")
    published_by: Optional[str] = Field(None, alias="publishedBy")
    change_summary: Optional[str] = Field(None, alias="changeSummary")
    question_count: int = Field(0, alias="questionCount")


class ApproveQuestionnaireRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    notes: Optional[str] = None


class PublishQuestionnaireRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    change_summary: Optional[str] = Field(None, alias="changeSummary")


class AiGenerateQuestionnairePayload(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_title: str = Field(..., alias="studyTitle")
    protocol_id: Optional[uuid.UUID] = Field(None, alias="protocolId")
    study_id: Optional[uuid.UUID] = Field(None, alias="studyId")
    research_aims: str = Field(..., alias="researchAims")
    target_population: str = Field(..., alias="targetPopulation")
    outcomes: List[str] = Field(default_factory=list)
    instrument_type: Optional[Literal["PRO", "ClinicianAdministered", "Screener", "Diagnostic"]] = Field(
        "PRO", alias="instrumentType"
    )
    suggested_question_count: Optional[int] = Field(10, ge=1, le=50, alias="suggestedQuestionCount")


class QuestionnaireMetricItem(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    study_id: str = Field(..., alias="studyId")
    title: str
    total_assigned: int = Field(0, alias="totalAssigned")
    total_completed: int = Field(0, alias="totalCompleted")
    completion_rate: float = Field(0.0, alias="completionRate")
    average_time_to_complete_minutes: Optional[float] = Field(None, alias="averageTimeToCompleteMinutes")
    status: Literal["active", "draft", "closed"] = "draft"
    last_response_at: Optional[datetime] = Field(None, alias="lastResponseAt")


class QuestionnaireMetricsResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_questionnaires: int = Field(0, alias="totalQuestionnaires")
    total_responses: int = Field(0, alias="totalResponses")
    average_completion_rate: float = Field(0.0, alias="averageCompletionRate")
    recent_questionnaires: List[QuestionnaireMetricItem] = Field(default_factory=list, alias="recentQuestionnaires")


class QuestionnaireExportExcelRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    responses: Dict[str, Any] = Field(default_factory=dict)
    remarks: Dict[str, str] = Field(default_factory=dict)
    participant_id: Optional[str] = Field(None, alias="participantId")


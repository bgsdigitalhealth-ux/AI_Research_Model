import abc
import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field
from app.core.config import settings
from app.core.exceptions import AIExecutionError, AIProviderNotConfiguredError

logger = logging.getLogger("ai_research_flow.ai_adapter")


# Standard Field Keys required by research protocol verification
PROTOCOL_FIELD_DEFINITIONS = [
    {"key": "studyTitle", "label": "Study Title", "type": "string"},
    {"key": "researchAims", "label": "Research Aims & Objectives", "type": "list"},
    {"key": "studyDesign", "label": "Study Design", "type": "string"},
    {"key": "targetPopulation", "label": "Target Population", "type": "string"},
    {"key": "inclusionCriteria", "label": "Inclusion Criteria", "type": "list"},
    {"key": "exclusionCriteria", "label": "Exclusion Criteria", "type": "list"},
    {"key": "samplingMethod", "label": "Sampling Method", "type": "string"},
    {"key": "sampleSize", "label": "Sample Size", "type": "string"},
    {"key": "primaryOutcomes", "label": "Primary Outcomes", "type": "list"},
    {"key": "secondaryOutcomes", "label": "Secondary Outcomes", "type": "list"},
    {"key": "variablesAndInstruments", "label": "Variables & Instruments", "type": "list"},
    {"key": "dataCollectionMethods", "label": "Data Collection Methods", "type": "list"},
    {"key": "statisticalAnalysisPlan", "label": "Statistical Analysis Plan", "type": "string"},
]


class ExtractedFieldEvidence(BaseModel):
    page_number: Optional[int] = Field(None, alias="pageNumber")
    paragraph_number: Optional[int] = Field(None, alias="paragraphNumber")
    section_title: Optional[str] = Field(None, alias="sectionTitle")
    source_text_snippet: str = Field(..., alias="sourceTextSnippet")


class ExtractedFieldData(BaseModel):
    key: str
    label: str
    ai_value: Any = Field(None, alias="aiValue")
    uncertainty: Optional[str] = "low"  # low, medium, high
    is_missing: bool = Field(False, alias="isMissing")
    confidence_score: Optional[float] = Field(None, alias="confidenceScore")
    evidence: Optional[ExtractedFieldEvidence] = None


class ExtractedProtocolResult(BaseModel):
    provider_name: str
    model_name: str
    prompt_version: str = "v1.0"
    fields: Dict[str, ExtractedFieldData]


def strip_participant_identifiers(text: str) -> str:
    """
    Strips direct participant identifiers (such as SSNs, national IDs, emails, phone numbers)
    before transmitting protocol excerpts to external AI providers.
    """
    # Mask emails
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[REDACTED_EMAIL]", text)
    # Mask 10-12 digit phone numbers
    text = re.sub(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "[REDACTED_PHONE]", text)
    # Mask SSN / national IDs (###-##-####)
    text = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_NATIONAL_ID]", text)
    return text


class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    async def extract_protocol_metadata(
        self,
        full_text: str,
        pages_meta: List[Dict[str, Any]],
    ) -> ExtractedProtocolResult:
        """
        Extracts structured protocol metadata from the parsed document text.
        Returns validated ExtractedProtocolResult with source evidence.
        """
        pass

    @abc.abstractmethod
    async def generate_questionnaire(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Synthesizes a structured candidate questionnaire based on approved protocol context and study outcomes.
        Returns validated dictionary containing sections, questions, and objective mappings.
        """
        pass


class UnconfiguredAIProvider(BaseAIProvider):
    async def extract_protocol_metadata(
        self,
        full_text: str,
        pages_meta: List[Dict[str, Any]],
    ) -> ExtractedProtocolResult:
        raise AIProviderNotConfiguredError(
            "AI extraction provider is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY "
            "in the backend environment configuration, or manually enter protocol fields."
        )

    async def generate_questionnaire(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        raise AIProviderNotConfiguredError(
            "AI generation provider is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY "
            "in the backend environment configuration, or manually design questionnaire questions."
        )


class GeminiAIProvider(BaseAIProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-1.5-pro"):
        self.api_key = api_key
        self.model_name = model_name

    async def extract_protocol_metadata(
        self,
        full_text: str,
        pages_meta: List[Dict[str, Any]],
    ) -> ExtractedProtocolResult:
        if settings.AI_STRIP_PARTICIPANT_IDENTIFIERS:
            full_text = strip_participant_identifiers(full_text)

        # Truncate text if excessively long while preserving document structure (up to ~60k chars)
        doc_sample = full_text[:60000]

        system_instruction = (
            "You are a clinical and scientific research protocol parser. "
            "Extract structured protocol fields from the provided document text. "
            "For each field, extract the factual value and quote the EXACT verbatim source sentence as evidence, "
            "including the page number where found. "
            "If a field is not found in the text, mark isMissing: true and aiValue: null. "
            "DO NOT FABRICATE OR HALLUCINATE ANY VALUE. "
            "Return JSON only with a 'fields' object containing keys: "
            "studyTitle, researchAims, studyDesign, targetPopulation, inclusionCriteria, "
            "exclusionCriteria, samplingMethod, sampleSize, primaryOutcomes, secondaryOutcomes, "
            "variablesAndInstruments, dataCollectionMethods, statisticalAnalysisPlan."
        )

        prompt = f"""
Protocol Document Excerpt:
{doc_sample}

Extract all fields according to the schema:
{{
  "fields": {{
    "studyTitle": {{ "aiValue": string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "researchAims": {{ "aiValue": [string] or string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "studyDesign": {{ "aiValue": string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "targetPopulation": {{ "aiValue": string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "inclusionCriteria": {{ "aiValue": [string] or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "exclusionCriteria": {{ "aiValue": [string] or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "samplingMethod": {{ "aiValue": string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "sampleSize": {{ "aiValue": string or int or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "primaryOutcomes": {{ "aiValue": [string] or string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "secondaryOutcomes": {{ "aiValue": [string] or string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "variablesAndInstruments": {{ "aiValue": [string] or string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "dataCollectionMethods": {{ "aiValue": [string] or string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }},
    "statisticalAnalysisPlan": {{ "aiValue": string or null, "isMissing": bool, "evidence": {{ "pageNumber": int, "sourceTextSnippet": string }} }}
  }}
}}
"""
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": f"{system_instruction}\n\n{prompt}"}]}],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(endpoint, json=payload)
                if resp.status_code != 200:
                    raise AIExecutionError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(raw_text)
            return self._build_result(parsed_json)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"Gemini extraction failed: {str(exc)}") from exc

    def _build_result(self, parsed_json: Dict[str, Any]) -> ExtractedProtocolResult:
        extracted_fields: Dict[str, ExtractedFieldData] = {}
        raw_fields = parsed_json.get("fields", {})

        for defn in PROTOCOL_FIELD_DEFINITIONS:
            k = defn["key"]
            f_data = raw_fields.get(k, {})
            evidence_data = f_data.get("evidence")
            evidence = None
            if evidence_data and evidence_data.get("sourceTextSnippet"):
                evidence = ExtractedFieldEvidence(
                    pageNumber=evidence_data.get("pageNumber"),
                    paragraphNumber=evidence_data.get("paragraphNumber"),
                    sectionTitle=evidence_data.get("sectionTitle"),
                    sourceTextSnippet=str(evidence_data.get("sourceTextSnippet")),
                )

            is_missing = f_data.get("isMissing", False) or f_data.get("aiValue") is None
            extracted_fields[k] = ExtractedFieldData(
                key=k,
                label=defn["label"],
                aiValue=f_data.get("aiValue"),
                uncertainty="low" if not is_missing else "high",
                isMissing=is_missing,
                confidence_score=0.95 if not is_missing else 0.0,
                evidence=evidence,
            )

        return ExtractedProtocolResult(
            provider_name="gemini",
            model_name=self.model_name,
            fields=extracted_fields,
        )

    async def generate_questionnaire(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        study_title = payload.get("studyTitle", "")
        research_aims = payload.get("researchAims", "")
        target_pop = payload.get("targetPopulation", "")
        outcomes = payload.get("outcomes", [])
        instrument_type = payload.get("instrumentType", "PRO")
        count = payload.get("suggestedQuestionCount", 10)

        system_instruction = (
            "You are a clinical psychometrician and questionnaire architect. "
            "Synthesize a scientifically sound candidate questionnaire for clinical research. "
            "Output JSON with 'title', 'description', 'sections', 'questions', and 'mappings'. "
            "Each question must include: 'id' (short hex), 'variableName' (alphanumeric identifier starting with letter), "
            "'type' ('short_text', 'long_text', 'integer', 'decimal', 'single_choice', 'multiple_choice', 'rating_5', 'likert_5'), "
            "'text', 'description', 'sectionId', 'order', 'validation' ({'required': bool}), "
            "'choices' ([{'code': str, 'label': str, 'score': float}] if choice type), "
            "'targetObjectiveId', 'targetOutcomeName'. "
            "Mappings must link each outcome to covered question IDs."
        )

        prompt = f"""
Study Title: {study_title}
Research Aims: {research_aims}
Target Population: {target_pop}
Target Outcomes: {json.dumps(outcomes)}
Instrument Type: {instrument_type}
Target Question Count: {count}

Generate a complete questionnaire draft adhering strictly to this schema. Output JSON only.
"""
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        req_body = {
            "contents": [{"parts": [{"text": f"{system_instruction}\n\n{prompt}"}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(endpoint, json=req_body)
                if resp.status_code != 200:
                    raise AIExecutionError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"Gemini questionnaire generation failed: {str(exc)}") from exc



class OpenAIProvider(BaseAIProvider):
    def __init__(self, api_key: str, model_name: str = "gpt-4o"):
        self.api_key = api_key
        self.model_name = model_name

    async def extract_protocol_metadata(
        self,
        full_text: str,
        pages_meta: List[Dict[str, Any]],
    ) -> ExtractedProtocolResult:
        if settings.AI_STRIP_PARTICIPANT_IDENTIFIERS:
            full_text = strip_participant_identifiers(full_text)

        doc_sample = full_text[:60000]
        prompt = f"Extract structured research protocol metadata with source evidence from this text:\n\n{doc_sample}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a clinical protocol extraction engine. Output JSON only. "
                        "Fields required: studyTitle, researchAims, studyDesign, targetPopulation, "
                        "inclusionCriteria, exclusionCriteria, samplingMethod, sampleSize, "
                        "primaryOutcomes, secondaryOutcomes, variablesAndInstruments, "
                        "dataCollectionMethods, statisticalAnalysisPlan. "
                        "Each field must have 'aiValue', 'isMissing', and 'evidence' with 'pageNumber' and 'sourceTextSnippet'."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
                if resp.status_code != 200:
                    raise AIExecutionError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(raw_text)
            return self._build_result(parsed_json)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"OpenAI extraction failed: {str(exc)}") from exc

    def _build_result(self, parsed_json: Dict[str, Any]) -> ExtractedProtocolResult:
        extracted_fields: Dict[str, ExtractedFieldData] = {}
        raw_fields = parsed_json.get("fields", parsed_json)

        for defn in PROTOCOL_FIELD_DEFINITIONS:
            k = defn["key"]
            f_data = raw_fields.get(k, {})
            if not isinstance(f_data, dict):
                f_data = {"aiValue": f_data}

            evidence_data = f_data.get("evidence")
            evidence = None
            if evidence_data and isinstance(evidence_data, dict) and evidence_data.get("sourceTextSnippet"):
                evidence = ExtractedFieldEvidence(
                    pageNumber=evidence_data.get("pageNumber"),
                    paragraphNumber=evidence_data.get("paragraphNumber"),
                    sectionTitle=evidence_data.get("sectionTitle"),
                    sourceTextSnippet=str(evidence_data.get("sourceTextSnippet")),
                )

            is_missing = f_data.get("isMissing", False) or f_data.get("aiValue") is None
            extracted_fields[k] = ExtractedFieldData(
                key=k,
                label=defn["label"],
                aiValue=f_data.get("aiValue"),
                uncertainty="low" if not is_missing else "high",
                isMissing=is_missing,
                confidence_score=0.90 if not is_missing else 0.0,
                evidence=evidence,
            )

        return ExtractedProtocolResult(
            provider_name="openai",
            model_name=self.model_name,
            fields=extracted_fields,
        )

    async def generate_questionnaire(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        study_title = payload.get("studyTitle", "")
        research_aims = payload.get("researchAims", "")
        target_pop = payload.get("targetPopulation", "")
        outcomes = payload.get("outcomes", [])
        instrument_type = payload.get("instrumentType", "PRO")
        count = payload.get("suggestedQuestionCount", 10)

        system_instruction = (
            "You are a clinical psychometrician and questionnaire architect. "
            "Synthesize a scientifically sound candidate questionnaire for clinical research. "
            "Output JSON with 'title', 'description', 'sections', 'questions', and 'mappings'. "
            "Each question must include: 'id' (short hex), 'variableName' (alphanumeric identifier starting with letter), "
            "'type' ('short_text', 'long_text', 'integer', 'decimal', 'single_choice', 'multiple_choice', 'rating_5', 'likert_5'), "
            "'text', 'description', 'sectionId', 'order', 'validation' ({'required': bool}), "
            "'choices' ([{'code': str, 'label': str, 'score': float}] if choice type), "
            "'targetObjectiveId', 'targetOutcomeName'. "
            "Mappings must link each outcome to covered question IDs."
        )

        prompt = f"""
Study Title: {study_title}
Research Aims: {research_aims}
Target Population: {target_pop}
Target Outcomes: {json.dumps(outcomes)}
Instrument Type: {instrument_type}
Target Question Count: {count}

Generate a complete questionnaire draft adhering strictly to this schema. Output JSON only.
"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        req_body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=req_body)
                if resp.status_code != 200:
                    raise AIExecutionError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"OpenAI questionnaire generation failed: {str(exc)}") from exc


def get_ai_provider() -> BaseAIProvider:
    """
    Factory function returning the active AI provider based on configuration.
    Fails safely if no valid provider key is set.
    """
    if settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        return GeminiAIProvider(api_key=settings.GEMINI_API_KEY, model_name=settings.GEMINI_MODEL)
    elif settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider(api_key=settings.OPENAI_API_KEY, model_name=settings.OPENAI_MODEL)
    elif settings.GEMINI_API_KEY:
        return GeminiAIProvider(api_key=settings.GEMINI_API_KEY, model_name=settings.GEMINI_MODEL)
    elif settings.OPENAI_API_KEY:
        return OpenAIProvider(api_key=settings.OPENAI_API_KEY, model_name=settings.OPENAI_MODEL)
    else:
        return UnconfiguredAIProvider()


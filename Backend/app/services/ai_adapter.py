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

    @abc.abstractmethod
    async def extract_questionnaire_from_document(
        self,
        full_text: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Parses questions from an uploaded document (PDF/DOCX/Excel/CSV) into the questionnaire template:
        - Question text (Mandatory)
        - Choices with radio buttons in a, b, c format (Mandatory)
        - Explanation (Optional)
        - Remark (Optional)
        """
        pass

    @abc.abstractmethod
    async def extract_questionnaire_from_image(
        self,
        image_data_uri: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Parses questions from an uploaded image (PNG, JPG, etc.) using AI vision capabilities
        into the standardized questionnaire template.
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

    async def extract_questionnaire_from_document(
        self,
        full_text: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        raise AIProviderNotConfiguredError(
            "AI provider is not configured. Please set OPENAI_API_KEY or GEMINI_API_KEY."
        )

    async def extract_questionnaire_from_image(
        self,
        image_data_uri: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        raise AIProviderNotConfiguredError(
            "AI provider is not configured. Please set OPENAI_API_KEY or GEMINI_API_KEY."
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

        doc_sample = full_text[:60000]
        prompt = f"Extract structured research protocol metadata with source evidence from this text:\n\n{doc_sample}"

        system_instruction = (
            "You are a clinical protocol extraction engine. Output JSON only. "
            "Fields required: studyTitle, researchAims, studyDesign, targetPopulation, "
            "inclusionCriteria, exclusionCriteria, samplingMethod, sampleSize, "
            "primaryOutcomes, secondaryOutcomes, variablesAndInstruments, "
            "dataCollectionMethods, statisticalAnalysisPlan. "
            "Each field must have 'aiValue', 'isMissing', and 'evidence' with 'pageNumber' and 'sourceTextSnippet'."
        )

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        req_body = {
            "contents": [{"parts": [{"text": f"{system_instruction}\n\n{prompt}"}]}],
            "generationConfig": {
                "temperature": 0.0,
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
            parsed_json = json.loads(raw_text)
            return self._build_result(parsed_json)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"Gemini protocol extraction failed: {str(exc)}") from exc

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
            "CRITICAL QUESTION RULES: "
            "1. NO SUBDESCRIPTION: Set 'description': null for EVERY question. Never generate subtitles, participant guidance, or subdescriptions on individual question items. "
            "2. RADIO BUTTON SINGLE CHOICE IN a, b, c FORMAT: All evaluation questions must use 'type': 'single_choice'. "
            "The 'choices' array must provide options in a, b, c format with 'code': 'a', 'b', 'c', 'd', ... and 'label': 'a) ...', 'b) ...', 'c) ...', 'd) ...'. "
            "3. EXPLANATION & REMARK TEMPLATE: Include 'explanation': str (optional rationale) and 'remark': str (optional commentary). "
            "Each question must include: 'id' (short hex), 'variableName', 'type': 'single_choice', 'text', 'description': null, 'explanation': null or str, 'remark': null or str, "
            "'sectionId', 'order', 'validation': {'required': true}, 'choices': [{'code': 'a', 'label': 'a) ...', 'score': 1.0}, {'code': 'b', 'label': 'b) ...', 'score': 2.0}, ...], "
            "'targetObjectiveId', 'targetOutcomeName'. "
            "'mappings': list of objects [{'objectiveId': str, 'objectiveTitle': str, 'outcomeName': str, 'coveredQuestionIds': list[str], 'isCovered': bool}]."
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

    async def extract_questionnaire_from_document(
        self,
        full_text: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        if settings.AI_STRIP_PARTICIPANT_IDENTIFIERS:
            full_text = strip_participant_identifiers(full_text)

        doc_sample = full_text[:60000]

        system_instruction = (
            "You are an expert psychometrician and assessment document parser. "
            "Extract questions from the uploaded document into a structured questionnaire template. "
            "CRITICAL TEMPLATE FORMAT: "
            "Each question must contain: "
            "1. 'text': Question prompt / statement. (MANDATORY) "
            "2. 'choices': List of choices with radio buttons. (MANDATORY) All choices in a, b, c format with 'code': 'a', 'b', 'c', 'd' and 'label': 'a) ...', 'b) ...'. "
            "3. 'explanation': Solution rationale, answer explanation, or concept details. (OPTIONAL, null if none) "
            "4. 'remark': Remarks, notes, instructor observations. (OPTIONAL, null if none) "
            "Each question has: 'id', 'variableName', 'type': 'single_choice', 'text', 'explanation', 'remark', 'description': null, 'validation': {'required': true}, 'choices'."
        )

        prompt = f"Document Filename: {filename or 'Questions.pdf'}\n\nContent:\n{doc_sample}"
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        req_body = {
            "contents": [{"parts": [{"text": f"{system_instruction}\n\n{prompt}"}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(endpoint, json=req_body)
                if resp.status_code != 200:
                    raise AIExecutionError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"Gemini question extraction failed: {str(exc)}") from exc


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
            "CRITICAL QUESTION RULES: "
            "1. NO SUBDESCRIPTION: Set 'description': null for EVERY question. Never generate subtitles, participant guidance, or subdescriptions on individual question items. "
            "2. RADIO BUTTON SINGLE CHOICE IN a, b, c FORMAT: All evaluation questions must use 'type': 'single_choice'. "
            "The 'choices' array must provide options in a, b, c format with 'code': 'a', 'b', 'c', 'd', ... and 'label': 'a) ...', 'b) ...', 'c) ...', 'd) ...'. "
            "3. QUESTION TEMPLATE FIELDS: Each question must include 'text' (mandatory), 'choices' (mandatory), "
            "'explanation' (optional clinical rationale or null), and 'remark' (optional research remark or null). "
            "Each question must include: 'id' (short hex), 'variableName', 'type': 'single_choice', 'text', 'description': null, 'explanation': null or str, 'remark': null or str, "
            "'sectionId', 'order', 'validation': {'required': true}, 'choices': [{'code': 'a', 'label': 'a) ...', 'score': 1.0}, {'code': 'b', 'label': 'b) ...', 'score': 2.0}, ...], "
            "'targetObjectiveId', 'targetOutcomeName'. "
            "'mappings': list of objects [{'objectiveId': str, 'objectiveTitle': str, 'outcomeName': str, 'coveredQuestionIds': list[str], 'isCovered': bool}]."
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

    async def extract_questionnaire_from_document(
        self,
        full_text: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        if settings.AI_STRIP_PARTICIPANT_IDENTIFIERS:
            full_text = strip_participant_identifiers(full_text)

        doc_sample = full_text[:120000]

        system_instruction = (
            "You are an expert psychometrician and questionnaire template extraction engine. "
            "Your task is to parse questions from the uploaded document (PDF/exam/question bank) and format them into the standardized questionnaire template. "
            "\n"
            "TOPIC-WISE & MULTI-SECTION EXTRACTION (CRITICAL REQUIREMENT): "
            "When the uploaded document (e.g. big PDF, multi-domain assessment, institutional rubric) contains multiple topics, modules, domains, chapters, or headings: "
            "1. You MUST detect all distinct topics/domains present in the document and create a dedicated section for each in the 'sections' array with a descriptive title and sequential 'order' (e.g. id: 'sec_1', title: 'Domain 1: Digital Governance & Leadership', id: 'sec_2', title: 'Domain 2: Learning Systems & AI Infrastructure', etc.). "
            "2. In each question inside the 'questions' array, you MUST populate 'sectionId' with the corresponding section id ('sec_1', 'sec_2', etc.) indicating which topic that question belongs to. "
            "3. Group questions logically under their respective topic so the generated questionnaire has a clear topic-wise modular layout. "
            "4. Do NOT combine multiple topics into a single generic section if distinct topics or domains exist in the document. "
            "\n"
            "CRITICAL QUESTION TEMPLATE FORMAT REQUIREMENTS: "
            "Every question in the template MUST strictly contain these 4 fields: "
            "1. 'text': The question statement / problem prompt. (THIS FIELD IS MANDATORY) "
            "2. 'choices': List of options with radio buttons. (THIS FIELD IS MANDATORY) "
            "   - 'type' must be 'single_choice'. "
            "   - Options must strictly be in a, b, c format: 'code': 'a', 'b', 'c', 'd', ... and 'label': 'a) ...', 'b) ...', 'c) ...', 'd) ...'. "
            "   - Extract all options presented in the document (supports 6 options for maturity/governance rubrics: 1. Not available [score 0], 2. Initial [score 2], 3. Partially implemented [score 4], 4. Implemented [score 6], 5. Consistently implemented [score 8], 6. Mature / exemplary [score 10]). Include 'score' property for each choice (e.g. 0, 2, 4, 6, 8, 10). If no options are given, generate 6 standard maturity rubric options with scores 0, 2, 4, 6, 8, 10. "
            "3. 'explanation': Detailed answer explanation, rationale, or solution breakdown. (THIS FIELD IS OPTIONAL - set to null if not found in document) "
            "4. 'remark': Remarks, commentary, notes, scoring hints, or examiner remarks. (THIS FIELD IS OPTIONAL - set to null if not found in document) "
            "\n"
            "Other required fields for each question: "
            "- 'id': unique short string (e.g. 'q_1', 'q_2') "
            "- 'sectionId': matching section ID from 'sections' (e.g. 'sec_1', 'sec_2') "
            "- 'variableName': valid identifier (e.g. 'Q1', 'Q2', 'VAR_1') "
            "- 'description': null (no subdescription) "
            "- 'order': integer (0-indexed) "
            "- 'validation': {'required': true} (Question and Options are mandatory) "
            "\n"
            "Output JSON format: "
            "{\n"
            "  \"title\": \"Title of the questionnaire from document header or filename\",\n"
            "  \"description\": \"Brief description or instructions\",\n"
            "  \"sections\": [\n"
            "    {\"id\": \"sec_1\", \"title\": \"Topic 1: Leadership & Strategic Governance\", \"description\": null, \"order\": 0},\n"
            "    {\"id\": \"sec_2\", \"title\": \"Topic 2: Digital Systems & Clinical Infrastructure\", \"description\": null, \"order\": 1}\n"
            "  ],\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"id\": \"q_1\",\n"
            "      \"sectionId\": \"sec_1\",\n"
            "      \"variableName\": \"Q1\",\n"
            "      \"type\": \"single_choice\",\n"
            "      \"text\": \"A formal Digital Governance Committee / authority is constituted with approved Terms of Reference.\",\n"
            "      \"explanation\": null,\n"
            "      \"remark\": null,\n"
            "      \"order\": 0,\n"
            "      \"validation\": {\"required\": true},\n"
            "      \"choices\": [\n"
            "        {\"id\": \"c1\", \"code\": \"a\", \"label\": \"a) 1. Not available\", \"score\": 0.0},\n"
            "        {\"id\": \"c2\", \"code\": \"b\", \"label\": \"b) 2. Initial\", \"score\": 2.0},\n"
            "        {\"id\": \"c3\", \"code\": \"c\", \"label\": \"c) 3. Partially implemented\", \"score\": 4.0},\n"
            "        {\"id\": \"c4\", \"code\": \"d\", \"label\": \"d) 4. Implemented\", \"score\": 6.0},\n"
            "        {\"id\": \"c5\", \"code\": \"e\", \"label\": \"e) 5. Consistently implemented\", \"score\": 8.0},\n"
            "        {\"id\": \"c6\", \"code\": \"f\", \"label\": \"f) 6. Mature / exemplary\", \"score\": 10.0}\n"
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        prompt = f"Uploaded File: {filename or 'Questionnaire_Document.pdf'}\n\nDocument Text Content:\n{doc_sample}"

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
            "temperature": 0.1,
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=req_body)
                if resp.status_code != 200:
                    raise AIExecutionError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"OpenAI question document extraction failed: {str(exc)}") from exc



    async def extract_questionnaire_from_image(
        self,
        image_data_uri: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        system_instruction = (
            "You are an expert psychometrician and visual assessment document parser. "
            "Your task is to examine the provided question sheet / test paper / survey image, "
            "extract every question from the image, and format them into the standardized questionnaire template. "
            "\n"
            "CRITICAL TEMPLATE FORMAT REQUIREMENTS: "
            "Every question in the template MUST strictly contain these 4 fields: "
            "1. 'text': The question statement / problem prompt. (THIS FIELD IS MANDATORY) "
            "2. 'choices': List of options with radio buttons. (THIS FIELD IS MANDATORY) "
            "   - 'type' must be 'single_choice'. "
            "   - Options must strictly be in a, b, c format: 'code': 'a', 'b', 'c', 'd', ... and 'label': 'a) ...', 'b) ...', 'c) ...', 'd) ...'. "
            "   - Extract all options presented in the document (supports 6 options for maturity/governance rubrics: 1. Not available [score 0], 2. Initial [score 2], 3. Partially implemented [score 4], 4. Implemented [score 6], 5. Consistently implemented [score 8], 6. Mature / exemplary [score 10]). Include 'score' property for each choice (e.g. 0, 2, 4, 6, 8, 10). If no options are given, generate 6 standard maturity rubric options with scores 0, 2, 4, 6, 8, 10. "
            "3. 'explanation': Detailed answer explanation, rationale, or solution breakdown. (THIS FIELD IS OPTIONAL - set to null if not found in image) "
            "4. 'remark': Remarks, commentary, notes, scoring hints, or examiner remarks. (THIS FIELD IS OPTIONAL - set to null if not found in image) "
            "\n"
            "Other required fields for each question: "
            "- 'id': unique short string (e.g. 'q_1', 'q_2') "
            "- 'variableName': valid identifier (e.g. 'Q1', 'Q2', 'VAR_1') "
            "- 'description': null (no subdescription) "
            "- 'order': integer (0-indexed) "
            "- 'validation': {'required': true} (Question and Options are mandatory) "
            "\n"
            "Output JSON format: "
            "{\n"
            "  \"title\": \"Title of the questionnaire from image or filename\",\n"
            "  \"description\": \"Brief overview of the questions in the image\",\n"
            "  \"sections\": [\n"
            "    {\"id\": \"sec_1\", \"title\": \"General Assessment\", \"description\": null, \"order\": 0}\n"
            "  ],\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"id\": \"q_1\",\n"
            "      \"variableName\": \"Q1\",\n"
            "      \"type\": \"single_choice\",\n"
            "      \"text\": \"Question text here\",\n"
            "      \"explanation\": \"Explanation here or null\",\n"
            "      \"remark\": \"Remark here or null\",\n"
            "      \"order\": 0,\n"
            "      \"validation\": {\"required\": true},\n"
            "      \"choices\": [\n"
            "        {\"id\": \"c1\", \"code\": \"a\", \"label\": \"a) Option 1\", \"score\": 1.0},\n"
            "        {\"id\": \"c2\", \"code\": \"b\", \"label\": \"b) Option 2\", \"score\": 2.0},\n"
            "        {\"id\": \"c3\", \"code\": \"c\", \"label\": \"c) Option 3\", \"score\": 3.0},\n"
            "        {\"id\": \"c4\", \"code\": \"d\", \"label\": \"d) Option 4\", \"score\": 4.0}\n"
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        req_body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_instruction},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Please parse and extract all questions from this image document ({filename or 'questions.png'}).",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_uri,
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=req_body)
                if resp.status_code != 200:
                    raise AIExecutionError(f"OpenAI Vision API returned HTTP {resp.status_code}: {resp.text}")
                data = resp.json()

            raw_text = data["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except Exception as exc:
            if isinstance(exc, (AIExecutionError, AIProviderNotConfiguredError)):
                raise
            raise AIExecutionError(f"OpenAI image question extraction failed: {str(exc)}") from exc


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

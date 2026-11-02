import json
import logging
import math
import re
from typing import Any, Dict, List, Optional, TypedDict
import httpx
from langgraph.graph import StateGraph, START, END

from app.core.config import settings
from app.services.pinecone_service import get_pinecone_service, DEFAULT_CLINICAL_QUESTIONS

logger = logging.getLogger("ai_research_flow.langgraph_rag")


class QuestionnaireRAGState(TypedDict):
    """
    State passed between nodes in the LangGraph agentic RAG generation pipeline.
    """
    # Inputs
    study_title: str
    research_aims: str
    target_population: str
    outcomes: List[str]
    instrument_type: str
    suggested_count: int
    query_text: str

    # Agent Pipeline Steps
    retrieved_candidates: List[Dict[str, Any]]
    reranked_exemplars: List[Dict[str, Any]]
    calibrated_system_prompt: str
    calibrated_user_prompt: str

    # Output
    raw_ai_output: Optional[Dict[str, Any]]
    validated_questionnaire: Optional[Dict[str, Any]]
    error: Optional[str]


def calculate_concept_overlap(query: str, text: str) -> float:
    """
    Computes lexical and medical concept overlap score between query and candidate text.
    """
    q_words = set(re.findall(r"\b[a-zA-Z]{3,}\b", query.lower()))
    t_words = set(re.findall(r"\b[a-zA-Z]{3,}\b", text.lower()))
    if not q_words or not t_words:
        return 0.1
    intersection = q_words.intersection(t_words)
    return len(intersection) / float(len(q_words))


# =============================================================================
# LANGGRAPH NODE 1: RETRIEVAL FROM PINECONE VECTOR DB
# =============================================================================
async def retrieve_candidates_node(state: QuestionnaireRAGState) -> Dict[str, Any]:
    """
    Queries Pinecone vector index under namespace 'AI-Research-Flow'
    using OpenAI embeddings to retrieve top-K candidate items.
    """
    pinecone_svc = get_pinecone_service()
    query = state.get("query_text") or f"{state.get('study_title', '')} {state.get('research_aims', '')} {' '.join(state.get('outcomes', []))}"
    query = query.strip() or "clinical research patient questionnaire"

    candidates: List[Dict[str, Any]] = []
    if pinecone_svc.is_configured:
        try:
            # Retrieve 12 candidates for downstream re-ranking
            candidates = await pinecone_svc.semantic_search(query=query, top_k=12)
        except Exception as e:
            logger.warning(f"LangGraph Pinecone retrieval error: {e}")

    if not candidates:
        logger.info("Using curated fallback clinical question bank for RAG retrieval.")
        candidates = DEFAULT_CLINICAL_QUESTIONS[:10]

    return {"retrieved_candidates": candidates}


# =============================================================================
# LANGGRAPH NODE 2: SEMANTIC RE-RANKING & RELEVANCE SCORING
# =============================================================================
async def rerank_candidates_node(state: QuestionnaireRAGState) -> Dict[str, Any]:
    """
    Applies multi-criterion semantic re-ranking across retrieved vector candidates:
    1. Cosine similarity score (45%)
    2. Concept and outcome token overlap (25%)
    3. Clinical domain relevance matching (15%)
    4. Psychometric structural calibration completeness (15%)
    """
    candidates = state.get("retrieved_candidates", [])
    query = state.get("query_text", "")
    study_title = state.get("study_title", "").lower()
    aims = state.get("research_aims", "").lower()

    scored_candidates = []
    for c in candidates:
        text = c.get("text", "")
        domain = c.get("domain", "").lower()
        base_score = float(c.get("score", 0.5))

        # 1. Concept overlap
        concept_score = calculate_concept_overlap(query, text)

        # 2. Domain match bonus
        domain_match = 0.0
        if domain:
            for term in (study_title + " " + aims).split():
                if len(term) > 3 and term in domain:
                    domain_match += 0.25
        domain_match = min(1.0, domain_match)

        # 3. Psychometric structure score
        choices = c.get("choices", [])
        has_choices = 1.0 if len(choices) >= 3 else 0.5
        has_explanation = 1.0 if c.get("explanation") else 0.4
        structure_score = (has_choices * 0.6) + (has_explanation * 0.4)

        # Composite Re-ranking Score
        rerank_score = (
            (base_score * 0.45)
            + (concept_score * 0.25)
            + (domain_match * 0.15)
            + (structure_score * 0.15)
        )

        scored_candidates.append({
            **c,
            "rerank_score": round(rerank_score, 4),
        })

    # Sort descending by re-ranking score
    scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
    top_exemplars = scored_candidates[:5]

    logger.info(f"LangGraph Re-ranker selected top {len(top_exemplars)} clinical exemplars.")
    return {"reranked_exemplars": top_exemplars}


# =============================================================================
# LANGGRAPH NODE 3: FINE-TUNED PROMPT CALIBRATION (FDA PRO Standards)
# =============================================================================
async def calibrate_prompt_node(state: QuestionnaireRAGState) -> Dict[str, Any]:
    """
    Applies specialized prompt fine-tuning and psychometric domain calibration.
    Enforces standardized 4-field template rules:
    - Text (Mandatory)
    - Radio choices in a, b, c format with scores (Mandatory)
    - Explanation (Optional clinical rationale)
    - Remark (Optional evaluator remark)
    - Description: Strictly null
    """
    study_title = state.get("study_title", "Clinical Investigation")
    research_aims = state.get("research_aims", "")
    target_pop = state.get("target_population") or "Target Study Cohort"
    outcomes = state.get("outcomes", [])
    instrument_type = state.get("instrumentType") or state.get("instrument_type") or "PRO"
    count = state.get("suggested_count", 10)
    exemplars = state.get("reranked_exemplars", [])

    system_instruction = (
        "You are an expert clinical psychometrician, health outcomes researcher, and questionnaire architect. "
        "Your task is to synthesize a high-validity, scientifically calibrated clinical research questionnaire. "
        "All generated questions must conform to FDA Patient-Reported Outcome (PRO) Guidance and GCP standards.\n\n"
        "STRICT MANDATORY QUESTION TEMPLATE RULES:\n"
        "1. NO SUBDESCRIPTION: Set 'description': null for every single question. Do not output secondary descriptions.\n"
        "2. RADIO BUTTON SINGLE CHOICE IN a, b, c FORMAT:\n"
        "   - 'type' must be 'single_choice'.\n"
        "   - 'choices' must contain options labeled strictly in a, b, c format: 'code': 'a', 'label': 'a) ...', 'score': 1.0; 'code': 'b', 'label': 'b) ...', 'score': 2.0, etc.\n"
        "   - Provide 4 to 6 clinically calibrated, mutually exclusive response options with ascending scores.\n"
        "3. EXPLANATION: Provide concise scientific rationale explaining the psychometric construct measured.\n"
        "4. REMARK: Provide scoring or researcher guidance note.\n"
        "5. VARIABLE NAMES: Format as 'Q1', 'Q2', etc.\n"
        "6. SECTIONS: Create 2 to 4 logical clinical domain sections (e.g., 'sec_1', 'sec_2') grouping items topic-wise.\n\n"
        "OUTPUT JSON SCHEMA:\n"
        "{\n"
        "  \"title\": \"Instrument Title\",\n"
        "  \"description\": \"Overview instructions for participants\",\n"
        "  \"sections\": [{\"id\": \"sec_1\", \"title\": \"Domain Title\", \"order\": 0}],\n"
        "  \"questions\": [\n"
        "    {\n"
        "      \"id\": \"q_1\",\n"
        "      \"sectionId\": \"sec_1\",\n"
        "      \"variableName\": \"Q1\",\n"
        "      \"type\": \"single_choice\",\n"
        "      \"text\": \"Question statement\",\n"
        "      \"description\": null,\n"
        "      \"explanation\": \"Diagnostic rationale\",\n"
        "      \"remark\": \"Endpoint evaluation guidance\",\n"
        "      \"order\": 0,\n"
        "      \"validation\": {\"required\": true},\n"
        "      \"choices\": [\n"
        "        {\"id\": \"c1\", \"code\": \"a\", \"label\": \"a) None\", \"score\": 0.0},\n"
        "        {\"id\": \"c2\", \"code\": \"b\", \"label\": \"b) Mild\", \"score\": 1.0},\n"
        "        {\"id\": \"c3\", \"code\": \"c\", \"label\": \"c) Moderate\", \"score\": 2.0},\n"
        "        {\"id\": \"c4\", \"code\": \"d\", \"label\": \"d) Severe\", \"score\": 3.0}\n"
        "      ]\n"
        "    }\n"
        "  ],\n"
        "  \"mappings\": [{\"objectiveId\": \"OBJ-1\", \"objectiveTitle\": \"...\", \"outcomeName\": \"...\", \"coveredQuestionIds\": [\"q_1\"], \"isCovered\": true}]\n"
        "}"
    )

    exemplars_formatted = ""
    if exemplars:
        exemplars_formatted = "\nRE-RANKED GROUNDED CLINICAL REFERENCE EXEMPLARS (Retrieved via Pinecone RAG):\n"
        for i, ex in enumerate(exemplars, 1):
            exemplars_formatted += f"Exemplar {i} [{ex.get('domain', 'Clinical')}]: {ex.get('text')}\n"
            if ex.get("choices"):
                labels = [c.get("label", "") for c in ex.get("choices", [])]
                exemplars_formatted += f"   Choices: {', '.join(labels)}\n"
            if ex.get("explanation"):
                exemplars_formatted += f"   Rationale: {ex.get('explanation')}\n"

    user_prompt = f"""
Study Title / Clinical Area: {study_title}
Research Aims & Objectives: {research_aims}
Target Population: {target_pop}
Target Clinical Outcomes: {json.dumps(outcomes)}
Instrument Classification: {instrument_type}
Target Question Count: {count}
{exemplars_formatted}

Synthesize a complete candidate questionnaire draft with exactly {count} candidate questions adhering strictly to the standardized 4-field single_choice format. Output JSON only.
"""
    return {
        "calibrated_system_prompt": system_instruction,
        "calibrated_user_prompt": user_prompt,
    }


# =============================================================================
# LANGGRAPH NODE 4: SYNTHESIS VIA CALIBRATED AI MODEL
# =============================================================================
async def synthesize_node(state: QuestionnaireRAGState) -> Dict[str, Any]:
    """
    Executes completion using OpenAI API with temperature 0.2 and structured JSON format.
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("OPENAI_API_KEY not configured; using deterministic fallback synthesis.")
        return {"raw_ai_output": None}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": state["calibrated_system_prompt"]},
            {"role": "user", "content": state["calibrated_user_prompt"]},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=75.0) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return {"raw_ai_output": parsed}
            else:
                logger.error(f"OpenAI completion error {resp.status_code}: {resp.text}")
                return {"raw_ai_output": None, "error": f"OpenAI error {resp.status_code}"}
    except Exception as e:
        logger.error(f"Synthesis node encountered exception: {e}")
        return {"raw_ai_output": None, "error": str(e)}


# =============================================================================
# LANGGRAPH NODE 5: STRUCTURAL COMPLIANCE & POST-PROCESSING VALIDATION
# =============================================================================
async def validate_structure_node(state: QuestionnaireRAGState) -> Dict[str, Any]:
    """
    Validates and sanitizes generated questions to guarantee strict compliance:
    - description is forced to None
    - choices are forced to a, b, c format with scores
    - questions have valid variable names (Q1, Q2, etc.)
    """
    raw = state.get("raw_ai_output")
    study_title = state.get("study_title") or "Clinical Research Study"

    if not raw or not isinstance(raw, dict) or not raw.get("questions"):
        # Fallback synthesis using re-ranked exemplars
        exemplars = state.get("reranked_exemplars", []) or DEFAULT_CLINICAL_QUESTIONS[:state.get("suggested_count", 5)]
        questions = []
        for i, ex in enumerate(exemplars[:state.get("suggested_count", 5)]):
            choices = ex.get("choices") or [
                {"id": "c1", "code": "a", "label": "a) Not at all", "score": 0.0},
                {"id": "c2", "code": "b", "label": "b) Several days", "score": 1.0},
                {"id": "c3", "code": "c", "label": "c) More than half the days", "score": 2.0},
                {"id": "c4", "code": "d", "label": "d) Nearly every day", "score": 3.0},
            ]
            questions.append({
                "id": f"q_{i+1}",
                "sectionId": "sec_1",
                "variableName": f"Q{i+1}",
                "type": "single_choice",
                "text": ex.get("text", f"Assessment Question {i+1}"),
                "description": None,
                "explanation": ex.get("explanation") or f"Standardized psychometric measurement for {ex.get('domain', 'endpoint')}.",
                "remark": ex.get("remark") or "Primary clinical assessment parameter.",
                "order": i,
                "validation": {"required": True},
                "choices": choices,
            })
        raw = {
            "title": f"{study_title} Assessment Instrument",
            "description": f"Standardized research instrument for {study_title}.",
            "sections": [{"id": "sec_1", "title": "Primary Efficacy Domain", "order": 0}],
            "questions": questions,
            "mappings": [{"objectiveId": "OBJ-1", "objectiveTitle": "Primary Efficacy", "outcomeName": "Primary Outcome", "coveredQuestionIds": ["q_1"], "isCovered": True}],
        }

    # Sanitize and guarantee template compliance
    letters = ["a", "b", "c", "d", "e", "f", "g", "h"]
    cleaned_questions = []
    for idx, q in enumerate(raw.get("questions", [])):
        q_id = q.get("id") or f"q_{idx+1}"
        var_name = q.get("variableName") or f"Q{idx+1}"
        q_text = q.get("text") or f"Assessment item {idx+1}"

        # Clean choices
        raw_choices = q.get("choices") or []
        cleaned_choices = []
        for c_idx, ch in enumerate(raw_choices):
            letter = letters[c_idx] if c_idx < len(letters) else f"opt_{c_idx+1}"
            label = str(ch.get("label", f"Option {c_idx+1}")).strip()
            # Ensure label starts with "a) "
            if not label.lower().startswith(f"{letter})"):
                label = re.sub(r"^[a-zA-Z0-9][\)\.\-]\s*", "", label)
                label = f"{letter}) {label}"
            cleaned_choices.append({
                "id": ch.get("id") or f"c_{c_idx+1}",
                "code": letter,
                "label": label,
                "score": float(ch.get("score", c_idx + 1)),
            })

        cleaned_questions.append({
            "id": q_id,
            "sectionId": q.get("sectionId") or "sec_1",
            "variableName": var_name,
            "type": "single_choice",
            "text": q_text,
            "description": None,  # Strictly null as requested
            "explanation": q.get("explanation"),
            "remark": q.get("remark"),
            "order": idx,
            "validation": {"required": True},
            "choices": cleaned_choices,
            "targetObjectiveId": q.get("targetObjectiveId"),
            "targetOutcomeName": q.get("targetOutcomeName"),
        })

    raw["questions"] = cleaned_questions
    return {"validated_questionnaire": raw}


# =============================================================================
# COMPILED LANGGRAPH PIPELINE
# =============================================================================
def build_questionnaire_rag_graph():
    """
    Constructs and compiles the end-to-end LangGraph agent pipeline:
    START -> retrieve -> rerank -> calibrate -> synthesize -> validate -> END
    """
    builder = StateGraph(QuestionnaireRAGState)

    builder.add_node("retrieve", retrieve_candidates_node)
    builder.add_node("rerank", rerank_candidates_node)
    builder.add_node("calibrate", calibrate_prompt_node)
    builder.add_node("synthesize", synthesize_node)
    builder.add_node("validate", validate_structure_node)

    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "rerank")
    builder.add_edge("rerank", "calibrate")
    builder.add_edge("calibrate", "synthesize")
    builder.add_edge("synthesize", "validate")
    builder.add_edge("validate", END)

    return builder.compile()


class LangGraphQuestionnaireService:
    """
    Service facade for LangGraph-driven RAG question generation with re-ranking.
    """
    def __init__(self):
        self.graph = build_questionnaire_rag_graph()

    async def generate(
        self,
        study_title: str,
        research_aims: str,
        target_population: Optional[str] = None,
        outcomes: Optional[List[str]] = None,
        instrument_type: str = "PRO",
        suggested_count: int = 10,
    ) -> Dict[str, Any]:
        """
        Executes the LangGraph RAG pipeline and returns the calibrated, validated questionnaire.
        """
        initial_state: QuestionnaireRAGState = {
            "study_title": study_title,
            "research_aims": research_aims,
            "target_population": target_population or "Clinical Study Cohort",
            "outcomes": outcomes or ["Primary Efficacy", "Functional Mobility"],
            "instrument_type": instrument_type,
            "suggested_count": suggested_count,
            "query_text": f"{study_title} {research_aims} {' '.join(outcomes or [])}",
            "retrieved_candidates": [],
            "reranked_exemplars": [],
            "calibrated_system_prompt": "",
            "calibrated_user_prompt": "",
            "raw_ai_output": None,
            "validated_questionnaire": None,
            "error": None,
        }

        final_state = await self.graph.ainvoke(initial_state)
        return final_state.get("validated_questionnaire") or {}


_langgraph_service_instance: Optional[LangGraphQuestionnaireService] = None


def get_langgraph_questionnaire_service() -> LangGraphQuestionnaireService:
    global _langgraph_service_instance
    if _langgraph_service_instance is None:
        _langgraph_service_instance = LangGraphQuestionnaireService()
    return _langgraph_service_instance

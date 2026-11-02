import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("ai_research_flow.pinecone_service")

# Curated reference question bank of clinical research questions
DEFAULT_CLINICAL_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "q_ref_dep_1",
        "domain": "Depression & Mood",
        "variableName": "dep_little_interest",
        "text": "Over the past 2 weeks, how often have you had little interest or pleasure in doing activities you usually enjoy?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Several days", "score": 1.0},
            {"code": "c", "label": "c) More than half the days", "score": 2.0},
            {"code": "d", "label": "d) Nearly every day", "score": 3.0},
        ],
        "explanation": "Evaluates core anhedonia symptom per DSM-5 criteria and standardized PHQ-9 measurement.",
        "remark": "Primary psychiatric efficacy endpoint in mood disorder clinical trials.",
    },
    {
        "id": "q_ref_dep_2",
        "domain": "Depression & Mood",
        "variableName": "dep_hopeless_mood",
        "text": "Over the past 2 weeks, how often have you felt down, depressed, or hopeless about your future?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Several days", "score": 1.0},
            {"code": "c", "label": "c) More than half the days", "score": 2.0},
            {"code": "d", "label": "d) Nearly every day", "score": 3.0},
        ],
        "explanation": "Assesses dysphoric affect and persistent depressive state.",
        "remark": "Essential item for tracking psychological response to clinical intervention.",
    },
    {
        "id": "q_ref_anx_1",
        "domain": "Anxiety & Stress",
        "variableName": "anx_nervous_tense",
        "text": "Over the last 2 weeks, how often have you felt nervous, anxious, on edge, or unable to relax?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Several days", "score": 1.0},
            {"code": "c", "label": "c) More than half the days", "score": 2.0},
            {"code": "d", "label": "d) Nearly every day", "score": 3.0},
        ],
        "explanation": "Standardized GAD-7 opening item measuring acute emotional tension and generalized anxiety.",
        "remark": "High sensitivity for screening generalized anxiety and panic symptoms.",
    },
    {
        "id": "q_ref_anx_2",
        "domain": "Anxiety & Stress",
        "variableName": "anx_worry_control",
        "text": "How often have you experienced difficulty controlling excessive worrying about various matters?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Several days", "score": 1.0},
            {"code": "c", "label": "c) More than half the days", "score": 2.0},
            {"code": "d", "label": "d) Nearly every day", "score": 3.0},
        ],
        "explanation": "Measures cognitive uncontrollability of worry, a diagnostic hallmark of anxiety disorders.",
        "remark": "Predictive of treatment compliance and cognitive coping stability.",
    },
    {
        "id": "q_ref_pain_1",
        "domain": "Pain & Functional Interference",
        "variableName": "pain_intensity_avg",
        "text": "What was your average level of physical bodily pain during the past 7 days?",
        "choices": [
            {"code": "a", "label": "a) No pain experienced", "score": 0.0},
            {"code": "b", "label": "b) Mild pain (does not disrupt activities)", "score": 1.0},
            {"code": "c", "label": "c) Moderate pain (noticeably restricts tasks)", "score": 2.0},
            {"code": "d", "label": "d) Severe / Disabling pain", "score": 3.0},
        ],
        "explanation": "Assesses subjective pain severity based on PROMIS numeric rating analog.",
        "remark": "Key secondary efficacy variable in orthopedic, oncologic, and analgesic trials.",
    },
    {
        "id": "q_ref_pain_2",
        "domain": "Pain & Functional Interference",
        "variableName": "pain_daily_interference",
        "text": "How much has physical pain or discomfort interfered with your ability to carry out normal day-to-day work or family activities?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Slightly / Mildly", "score": 1.0},
            {"code": "c", "label": "c) Moderately", "score": 2.0},
            {"code": "d", "label": "d) Extremely / Completely prevented activity", "score": 3.0},
        ],
        "explanation": "Measures functional disability secondary to pain as recommended by IMMPACT guidelines.",
        "remark": "Correlates strongly with patient return-to-work and rehabilitation velocity.",
    },
    {
        "id": "q_ref_cog_1",
        "domain": "Cognitive Function & Memory",
        "variableName": "cog_memory_recall",
        "text": "In the past month, how frequently have you experienced trouble recalling recent conversations, names, or where you placed familiar objects?",
        "choices": [
            {"code": "a", "label": "a) Never or very rarely", "score": 0.0},
            {"code": "b", "label": "b) Occasionally (1-2 times per week)", "score": 1.0},
            {"code": "c", "label": "c) Frequently (almost daily)", "score": 2.0},
            {"code": "d", "label": "d) Continuously / Severely impaired", "score": 3.0},
        ],
        "explanation": "Evaluates short-term episodic memory lapses in geriatric and neurocognitive cohorts.",
        "remark": "Sensitive indicator for early mild cognitive impairment (MCI) or post-chemotherapy cognitive shifts.",
    },
    {
        "id": "q_ref_cog_2",
        "domain": "Cognitive Function & Memory",
        "variableName": "cog_sustained_focus",
        "text": "How often do you find it difficult to sustain mental focus when reading complex material or following a prolonged conversation?",
        "choices": [
            {"code": "a", "label": "a) Never", "score": 0.0},
            {"code": "b", "label": "b) Sometimes", "score": 1.0},
            {"code": "c", "label": "c) Often", "score": 2.0},
            {"code": "d", "label": "d) Almost always", "score": 3.0},
        ],
        "explanation": "Measures executive functioning, processing speed, and sustained selective attention.",
        "remark": "Useful for monitoring neuro-protective therapies and cognitive rehabilitation.",
    },
    {
        "id": "q_ref_fatigue_1",
        "domain": "Fatigue & Sleep Quality",
        "variableName": "fatigue_morning_exhaustion",
        "text": "During the past week, how frequently did you wake up feeling unrefreshed, fatigued, or physically drained despite sleeping?",
        "choices": [
            {"code": "a", "label": "a) Rarely or never", "score": 0.0},
            {"code": "b", "label": "b) 1 to 2 mornings", "score": 1.0},
            {"code": "c", "label": "c) 3 to 5 mornings", "score": 2.0},
            {"code": "d", "label": "d) Every single morning", "score": 3.0},
        ],
        "explanation": "Derived from the FACIT-Fatigue and Pittsburgh Sleep Quality Index (PSQI) scales.",
        "remark": "Detects unrefreshing non-restorative sleep patterns and chronic clinical exhaustion.",
    },
    {
        "id": "q_ref_fatigue_2",
        "domain": "Fatigue & Sleep Quality",
        "variableName": "fatigue_exertion_limit",
        "text": "To what degree did overwhelming tiredness or low energy limit your capacity to perform routine physical exertion?",
        "choices": [
            {"code": "a", "label": "a) No limitation", "score": 0.0},
            {"code": "b", "label": "b) Minor limitation", "score": 1.0},
            {"code": "c", "label": "c) Substantial limitation", "score": 2.0},
            {"code": "d", "label": "d) Unable to perform exertion", "score": 3.0},
        ],
        "explanation": "Gauges physical stamina and perceived fatigue thresholds in chronic disease.",
        "remark": "Benchmark patient-reported outcome in oncology, rheumatology, and post-viral recovery.",
    },
    {
        "id": "q_ref_med_1",
        "domain": "Medication Adherence & Safety",
        "variableName": "med_missed_doses",
        "text": "Over the past month, how often did you forget, miss, or intentionally skip taking your prescribed study or chronic medications?",
        "choices": [
            {"code": "a", "label": "a) Never missed a dose", "score": 0.0},
            {"code": "b", "label": "b) 1-2 times during the month", "score": 1.0},
            {"code": "c", "label": "c) 1-2 times per week", "score": 2.0},
            {"code": "d", "label": "d) Several times every week", "score": 3.0},
        ],
        "explanation": "Adheres to Morisky Medication Adherence Scale (MMAS-8) construct principles.",
        "remark": "Essential compliance monitoring parameter for intention-to-treat and per-protocol statistical splits.",
    },
    {
        "id": "q_ref_med_2",
        "domain": "Medication Adherence & Safety",
        "variableName": "med_adverse_effects",
        "text": "Have you experienced any uncomfortable side effects (such as nausea, dizziness, or rash) that made you hesitate to take your medication?",
        "choices": [
            {"code": "a", "label": "a) No side effects experienced", "score": 0.0},
            {"code": "b", "label": "b) Mild side effects (managed easily)", "score": 1.0},
            {"code": "c", "label": "c) Moderate side effects (caused hesitation)", "score": 2.0},
            {"code": "d", "label": "d) Severe side effects (stopped medication)", "score": 3.0},
        ],
        "explanation": "Quantifies patient-reported tolerability and safety signals under GCP safety reporting.",
        "remark": "Triggers pharmacovigilance safety evaluation if option d is selected.",
    },
    {
        "id": "q_ref_qol_1",
        "domain": "Quality of Life & Wellbeing",
        "variableName": "qol_overall_health",
        "text": "In general, how would you rate your overall health, physical vitality, and daily wellbeing at this present time?",
        "choices": [
            {"code": "a", "label": "a) Excellent", "score": 4.0},
            {"code": "b", "label": "b) Good", "score": 3.0},
            {"code": "c", "label": "c) Fair", "score": 2.0},
            {"code": "d", "label": "d) Poor", "score": 1.0},
        ],
        "explanation": "Standard SF-36 and EQ-5D anchor question for global subjective health status.",
        "remark": "Strong independent predictor of longitudinal morbidity and clinical recovery.",
    },
    {
        "id": "q_ref_qol_2",
        "domain": "Quality of Life & Wellbeing",
        "variableName": "qol_social_participation",
        "text": "During the past 4 weeks, to what extent has your physical health or emotional status hindered your normal social activities with friends and family?",
        "choices": [
            {"code": "a", "label": "a) Not at all", "score": 0.0},
            {"code": "b", "label": "b) Slightly", "score": 1.0},
            {"code": "c", "label": "c) Moderately", "score": 2.0},
            {"code": "d", "label": "d) Most or all of the time", "score": 3.0},
        ],
        "explanation": "Evaluates social domain participation restriction per WHO International Classification of Functioning (ICF).",
        "remark": "Highlights psychosocial recovery beyond purely biochemical biomarkers.",
    },
    {
        "id": "q_ref_resp_1",
        "domain": "Cardiopulmonary & Respiratory Health",
        "variableName": "resp_shortness_breath",
        "text": "How often do you experience shortness of breath or labored breathing when walking on level ground at an ordinary pace?",
        "choices": [
            {"code": "a", "label": "a) Never (only with strenuous exercise)", "score": 0.0},
            {"code": "b", "label": "b) Occasionally (hurrying or slight hill)", "score": 1.0},
            {"code": "c", "label": "c) Walk slower than people of same age due to breathlessness", "score": 2.0},
            {"code": "d", "label": "d) Stop for breath after walking 100 meters or when dressing", "score": 3.0},
        ],
        "explanation": "Constructed from Modified Medical Research Council (mMRC) Dyspnea Scale.",
        "remark": "Primary functional stratification criterion in asthma, COPD, and heart failure cohorts.",
    },
    {
        "id": "q_ref_met_1",
        "domain": "Metabolic & Diabetes Care",
        "variableName": "met_blood_glucose_monitoring",
        "text": "How consistently over the last 14 days have you monitored your blood glucose levels or dietary carbohydrate intake according to clinical instructions?",
        "choices": [
            {"code": "a", "label": "a) Fully compliant every day", "score": 3.0},
            {"code": "b", "label": "b) Compliant most days (5-6 days/week)", "score": 2.0},
            {"code": "c", "label": "c) Occasionally compliant (2-4 days/week)", "score": 1.0},
            {"code": "d", "label": "d) Rarely or never monitored", "score": 0.0},
        ],
        "explanation": "Measures diabetic self-management and metabolic behavioral discipline.",
        "remark": "Directly correlates with HbA1c variance and glycemic control stability.",
    },
]


class PineconeVectorService:
    """
    Pinecone Vector Database Service for Semantic Search and Grounded Question Generation.
    Uses OpenAI text-embedding-3-small (1536 dim) for high-accuracy vector embeddings.
    """

    def __init__(self):
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX_NAME
        self.host = settings.PINECONE_HOST or "https://ai-research-questions-n0puoip.svc.aped-4627-b74a.pinecone.io"
        self.openai_api_key = settings.OPENAI_API_KEY
        self.embedding_model = "text-embedding-3-small"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.host)

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generates 1536-dimensional vector embedding for text using OpenAI API.
        """
        if not self.openai_api_key:
            logger.warning("OpenAI API key missing for embedding generation.")
            return None

        clean_text = text.replace("\n", " ").strip()
        if not clean_text:
            return None

        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "input": clean_text,
            "model": self.embedding_model,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["data"][0]["embedding"]
                else:
                    logger.error(f"OpenAI embedding error {res.status_code}: {res.text}")
                    return None
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return None

    async def get_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Batch embeds a list of strings in a single OpenAI request.
        """
        if not self.openai_api_key or not texts:
            return [None] * len(texts)

        clean_texts = [t.replace("\n", " ").strip() or "clinical question" for t in texts]
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "input": clean_texts,
            "model": self.embedding_model,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    embeddings_map = {item["index"]: item["embedding"] for item in data["data"]}
                    return [embeddings_map.get(i) for i in range(len(texts))]
                else:
                    logger.error(f"OpenAI batch embedding error {res.status_code}: {res.text}")
                    return [None] * len(texts)
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            return [None] * len(texts)

    async def upsert_questions(self, questions: List[Dict[str, Any]]) -> bool:
        """
        Upserts structured clinical questions with metadata into Pinecone vector index.
        """
        if not self.is_configured:
            logger.warning("Pinecone vector service is not configured.")
            return False

        texts_to_embed = [
            f"Domain: {q.get('domain', 'Clinical Research')}. Question: {q.get('text', '')}. Explanation: {q.get('explanation', '')}"
            for q in questions
        ]

        embeddings = await self.get_embeddings_batch(texts_to_embed)

        vectors = []
        for q, emb in zip(questions, embeddings):
            if emb is None:
                continue
            qid = str(q.get("id") or f"q_{hash(q.get('text', ''))}")
            metadata = {
                "text": q.get("text", ""),
                "domain": q.get("domain", "Clinical Evaluation"),
                "variableName": q.get("variableName", "var_metric"),
                "type": q.get("type", "single_choice"),
                "explanation": q.get("explanation") or "",
                "remark": q.get("remark") or "",
                "choices_json": json.dumps(q.get("choices", [])),
            }
            vectors.append({"id": qid, "values": emb, "metadata": metadata})

        if not vectors:
            logger.warning("No vectors created to upsert into Pinecone.")
            return False

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }
        upsert_payload = {"vectors": vectors}

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(f"{self.host}/vectors/upsert", headers=headers, json=upsert_payload)
                if res.status_code == 200:
                    logger.info(f"Successfully upserted {len(vectors)} questions into Pinecone.")
                    return True
                else:
                    logger.error(f"Pinecone upsert error {res.status_code}: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"Pinecone upsert failed: {e}")
            return False

    async def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        domain_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic similarity search against Pinecone vector database.
        Returns matching validated question items ranked by cosine relevance.
        """
        if not self.is_configured:
            logger.warning("Pinecone service not configured; using fallback search.")
            return self._fallback_keyword_search(query, top_k)

        query_emb = await self.get_embedding(query)
        if not query_emb:
            return self._fallback_keyword_search(query, top_k)

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }
        query_payload: Dict[str, Any] = {
            "vector": query_emb,
            "topK": top_k,
            "includeMetadata": True,
        }
        if domain_filter:
            query_payload["filter"] = {"domain": {"$eq": domain_filter}}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{self.host}/query", headers=headers, json=query_payload)
                if res.status_code == 200:
                    data = res.json()
                    matches = data.get("matches", [])
                    results = []
                    for m in matches:
                        meta = m.get("metadata", {})
                        choices = []
                        if "choices_json" in meta:
                            try:
                                choices = json.loads(meta["choices_json"])
                            except Exception:
                                choices = []

                        results.append({
                            "id": m.get("id"),
                            "score": round(float(m.get("score", 0.0)), 4),
                            "text": meta.get("text", ""),
                            "domain": meta.get("domain", "Clinical Evaluation"),
                            "variableName": meta.get("variableName", "metric"),
                            "type": meta.get("type", "single_choice"),
                            "choices": choices,
                            "explanation": meta.get("explanation") or None,
                            "remark": meta.get("remark") or None,
                        })
                    return results
                else:
                    logger.error(f"Pinecone query error {res.status_code}: {res.text}")
                    return self._fallback_keyword_search(query, top_k)
        except Exception as e:
            logger.error(f"Pinecone semantic search request failed: {e}")
            return self._fallback_keyword_search(query, top_k)

    def _fallback_keyword_search(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """
        In-memory fallback search across reference questions if network is offline.
        """
        q_lower = query.lower()
        scored = []
        for q in DEFAULT_CLINICAL_QUESTIONS:
            score = 0.5
            text_lower = q["text"].lower()
            domain_lower = q["domain"].lower()
            for word in q_lower.split():
                if len(word) > 2:
                    if word in text_lower:
                        score += 0.15
                    if word in domain_lower:
                        score += 0.2
            scored.append((score, q))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "id": item["id"],
                "score": round(score, 4),
                "text": item["text"],
                "domain": item["domain"],
                "variableName": item["variableName"],
                "type": "single_choice",
                "choices": item["choices"],
                "explanation": item.get("explanation"),
                "remark": item.get("remark"),
            }
            for score, item in scored[:top_k]
        ]

    async def ensure_index_seeded(self) -> bool:
        """
        Checks if Pinecone index has vectors; if empty, automatically seeds the reference question bank.
        """
        if not self.is_configured:
            return False

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(f"{self.host}/describe_index_stats", headers=headers, json={})
                if res.status_code == 200:
                    stats = res.json()
                    total_count = stats.get("totalVectorCount", 0)
                    if total_count == 0:
                        logger.info("Pinecone index is empty. Seeding initial clinical questions bank...")
                        return await self.upsert_questions(DEFAULT_CLINICAL_QUESTIONS)
                    return True
        except Exception as e:
            logger.error(f"Failed to check Pinecone index stats: {e}")
            return False
        return False


_pinecone_service_instance: Optional[PineconeVectorService] = None


def get_pinecone_service() -> PineconeVectorService:
    global _pinecone_service_instance
    if _pinecone_service_instance is None:
        _pinecone_service_instance = PineconeVectorService()
    return _pinecone_service_instance

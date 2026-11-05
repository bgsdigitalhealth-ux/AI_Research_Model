import json
import logging
from typing import Any, Dict, List, Optional
import httpx
try:
    from pinecone import Pinecone
    HAS_PINECONE = True
except (ImportError, Exception):
    HAS_PINECONE = False
    Pinecone = None
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
    Uses the official Pinecone Python Client and OpenAI text-embedding-3-small (1536 dim).
    """

    def __init__(self):
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX_NAME
        self.namespace = settings.PINECONE_NAMESPACE or "AI-Research-Flow"
        self.openai_api_key = settings.OPENAI_API_KEY
        self.embedding_model = "text-embedding-3-small"
        self._pc: Optional[Pinecone] = None
        self._index = None

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.index_name)

    def _get_index(self):
        """
        Lazily initializes the official Pinecone client and index connection.
        """
        if self._index is None and self.is_configured and HAS_PINECONE:
            try:
                self._pc = Pinecone(api_key=self.api_key)
                self._index = self._pc.Index(self.index_name)
            except Exception as e:
                logger.error(f"Failed to initialize Pinecone client: {e}")
                self._index = None
        return self._index

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
        Batch embeds a list of strings in chunks using OpenAI API.
        """
        if not self.openai_api_key or not texts:
            return [None] * len(texts)

        results: List[Optional[List[float]]] = []
        chunk_size = 50

        for i in range(0, len(texts), chunk_size):
            chunk = texts[i : i + chunk_size]
            clean_chunk = [t.replace("\n", " ").strip() or "clinical research question" for t in chunk]
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": clean_chunk,
                "model": self.embedding_model,
            }

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        embeddings_map = {item["index"]: item["embedding"] for item in data["data"]}
                        results.extend([embeddings_map.get(j) for j in range(len(chunk))])
                    else:
                        logger.error(f"OpenAI batch embedding error {res.status_code}: {res.text}")
                        results.extend([None] * len(chunk))
            except Exception as e:
                logger.error(f"Failed to generate batch embeddings chunk: {e}")
                results.extend([None] * len(chunk))

        return results

    async def upsert_questions(
        self,
        questions: List[Dict[str, Any]],
        namespace: Optional[str] = None,
    ) -> bool:
        """
        Upserts structured clinical questions with metadata into Pinecone vector index.
        Stores into the designated namespace (default: 'AI-Research-Flow') and mirrors to default.
        """
        idx = self._get_index()
        if not idx:
            logger.warning("Pinecone index connection not available.")
            return False

        target_ns = namespace or self.namespace

        texts_to_embed = [
            f"Domain: {q.get('domain', 'Clinical Research')}. Question: {q.get('text', '')}. Explanation: {q.get('explanation', '')}"
            for q in questions
        ]

        embeddings = await self.get_embeddings_batch(texts_to_embed)

        vectors = []
        for q, emb in zip(questions, embeddings):
            if emb is None:
                continue
            qid = str(q.get("id") or f"q_{abs(hash(q.get('text', '')))}")
            metadata = {
                "text": str(q.get("text", "")),
                "domain": str(q.get("domain", "Clinical Evaluation")),
                "variableName": str(q.get("variableName", "metric")),
                "type": str(q.get("type", "single_choice")),
                "explanation": str(q.get("explanation") or ""),
                "remark": str(q.get("remark") or ""),
                "choices_json": json.dumps(q.get("choices", [])),
            }
            vectors.append({"id": qid, "values": emb, "metadata": metadata})

        if not vectors:
            logger.warning("No vectors created to upsert into Pinecone.")
            return False

        # Upsert in chunks of 50 to Pinecone
        batch_size = 50
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            try:
                # Upsert into user namespace (e.g. AI-Research-Flow)
                idx.upsert(vectors=batch, namespace=target_ns)
                # Also mirror into default namespace for universal availability
                if target_ns != "":
                    try:
                        idx.upsert(vectors=batch, namespace="")
                    except Exception:
                        pass
            except Exception as e:
                logger.error(f"Pinecone upsert batch failed: {e}")
                return False

        logger.info(f"Successfully upserted {len(vectors)} questions into Pinecone namespace '{target_ns}'.")
        return True

    async def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        domain_filter: Optional[str] = None,
        namespace: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic similarity search against Pinecone vector database.
        Returns matching validated question items ranked by cosine relevance.
        """
        idx = self._get_index()
        if not idx:
            logger.warning("Pinecone client not configured; using fallback search.")
            return self._fallback_keyword_search(query, top_k)

        query_emb = await self.get_embedding(query)
        if not query_emb:
            return self._fallback_keyword_search(query, top_k)

        target_ns = namespace or self.namespace
        filter_dict = {"domain": {"$eq": domain_filter}} if domain_filter else None

        try:
            # Query the specified namespace first
            res = idx.query(
                vector=query_emb,
                top_k=top_k,
                include_metadata=True,
                namespace=target_ns,
                filter=filter_dict,
            )

            matches = res.get("matches", [])

            # If no matches in target namespace, fall back to default namespace
            if not matches and target_ns != "":
                res_default = idx.query(
                    vector=query_emb,
                    top_k=top_k,
                    include_metadata=True,
                    namespace="",
                    filter=filter_dict,
                )
                matches = res_default.get("matches", [])

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
            return results if results else self._fallback_keyword_search(query, top_k)
        except Exception as e:
            logger.error(f"Pinecone semantic search failed: {e}")
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
        Checks if Pinecone index has vectors in the namespace; if empty, automatically seeds reference bank.
        """
        idx = self._get_index()
        if not idx:
            return False

        try:
            stats = idx.describe_index_stats()
            namespaces = stats.to_dict().get("namespaces", {})
            target_ns_count = namespaces.get(self.namespace, {}).get("vector_count", 0)

            if target_ns_count == 0:
                logger.info(f"Namespace '{self.namespace}' has 0 vectors. Seeding clinical reference questions...")
                return await self.upsert_questions(DEFAULT_CLINICAL_QUESTIONS, namespace=self.namespace)
            return True
        except Exception as e:
            logger.error(f"Failed to check Pinecone index stats: {e}")
            return False

    async def sync_all_database_data(self, session) -> Dict[str, Any]:
        """
        Gathers ALL questions, questionnaires, protocols, and studies from PostgreSQL database,
        generates vector embeddings for each, and stores them in Pinecone under the namespace.
        """
        from sqlalchemy import select
        from app.models.question_item import QuestionItemModel
        from app.models.questionnaire import Questionnaire
        from app.models.study import Study
        from app.models.protocol import Protocol

        idx = self._get_index()
        if not idx:
            return {"status": "error", "message": "Pinecone index not configured."}

        # 1. Fetch all questions
        stmt_q = select(QuestionItemModel)
        res_q = await session.execute(stmt_q)
        db_questions = res_q.scalars().all()

        # 2. Fetch all questionnaires
        stmt_qn = select(Questionnaire)
        res_qn = await session.execute(stmt_qn)
        db_questionnaires = res_qn.scalars().all()

        # 3. Fetch all studies
        stmt_s = select(Study)
        res_s = await session.execute(stmt_s)
        db_studies = res_s.scalars().all()

        # Build items to embed
        items_to_embed = []

        # Reference Clinical Questions
        for q in DEFAULT_CLINICAL_QUESTIONS:
            items_to_embed.append({
                "id": f"ref_{q['id']}",
                "text": q["text"],
                "domain": f"Standardized Bank - {q['domain']}",
                "variableName": q["variableName"],
                "type": "single_choice",
                "choices": q.get("choices", []),
                "explanation": q.get("explanation"),
                "remark": q.get("remark"),
            })

        # Database Question Items
        for q in db_questions:
            items_to_embed.append({
                "id": f"db_q_{q.id}",
                "text": q.text,
                "domain": "Database Question Bank",
                "variableName": q.variable_name,
                "type": q.type,
                "choices": q.choices or [],
                "explanation": q.explanation,
                "remark": q.remark,
            })

        # Database Questionnaires
        for qn in db_questionnaires:
            desc = qn.description or f"Clinical instrument for {qn.title}"
            items_to_embed.append({
                "id": f"db_qn_{qn.id}",
                "text": f"Questionnaire: {qn.title}. {desc}",
                "domain": "Questionnaire Instrument",
                "variableName": f"qn_{str(qn.id)[:8]}",
                "type": "instrument",
                "choices": [],
                "explanation": qn.scientific_validation_claim,
                "remark": f"Status: {qn.status}, Version: {qn.version}",
            })

        # Studies
        for s in db_studies:
            items_to_embed.append({
                "id": f"db_study_{s.id}",
                "text": f"Study Protocol: {s.title}. Objectives: {s.research_aims or 'Clinical trial'}. Outcomes: {s.primary_outcomes or ''}",
                "domain": "Research Study Protocol",
                "variableName": f"study_{str(s.id)[:8]}",
                "type": "study_protocol",
                "choices": [],
                "explanation": f"Protocol Number: {s.protocol_number}",
                "remark": f"Phase: {s.phase or 'Observational'}",
            })

        logger.info(f"Total items gathered for Pinecone vector embedding: {len(items_to_embed)}")

        # Upsert all items into Pinecone namespace
        success = await self.upsert_questions(items_to_embed, namespace=self.namespace)

        stats = idx.describe_index_stats()
        ns_stats = stats.to_dict().get("namespaces", {})

        return {
            "status": "success" if success else "failed",
            "namespace": self.namespace,
            "total_items_embedded": len(items_to_embed),
            "questions_synced": len(db_questions),
            "questionnaires_synced": len(db_questionnaires),
            "studies_synced": len(db_studies),
            "reference_questions_synced": len(DEFAULT_CLINICAL_QUESTIONS),
            "pinecone_namespaces": ns_stats,
        }


_pinecone_service_instance: Optional[PineconeVectorService] = None


def get_pinecone_service() -> PineconeVectorService:
    global _pinecone_service_instance
    if _pinecone_service_instance is None:
        _pinecone_service_instance = PineconeVectorService()
    return _pinecone_service_instance

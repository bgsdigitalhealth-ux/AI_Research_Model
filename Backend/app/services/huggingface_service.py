import logging
from typing import Any, Dict, List, Optional
import httpx

try:
    from huggingface_hub import InferenceClient
    HAS_HF_HUB = True
except (ImportError, Exception):
    HAS_HF_HUB = False
    InferenceClient = None

from app.core.config import settings

logger = logging.getLogger("ai_research_flow.huggingface_service")


class HuggingFaceService:
    """
    Hugging Face Service handling Embeddings Ingestion and LLM Inference.
    Matches the System Architecture:
    - Ingestion Layer: Embed (Hugging Face: sentence-transformers/all-MiniLM-L6-v2) -> Store in Pinecone
    - LLM Layer: Meta Llama 3 / Mistral via Hugging Face Inference API
    """

    def __init__(self):
        self.api_key = settings.HUGGINGFACE_API_KEY
        self.model_name = settings.HUGGINGFACE_MODEL or "meta-llama/Meta-Llama-3-8B-Instruct"
        self.embedding_model = settings.HUGGINGFACE_EMBEDDING_MODEL or "sentence-transformers/all-MiniLM-L6-v2"
        self._client: Optional[Any] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("hf_"))

    def _get_client(self):
        if self._client is None and HAS_HF_HUB:
            try:
                # Initialize official Hugging Face InferenceClient
                token = self.api_key if self.is_configured else None
                self._client = InferenceClient(api_key=token)
            except Exception as e:
                logger.warning(f"Failed to initialize Hugging Face InferenceClient: {e}")
                self._client = None
        return self._client

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Embeds text using Hugging Face sentence-transformers model.
        """
        client = self._get_client()
        clean_text = text.replace("\n", " ").strip()
        if not clean_text:
            return None

        # Attempt 1: via official Hugging Face InferenceClient
        if client and self.is_configured:
            try:
                embedding = client.feature_extraction(clean_text, model=self.embedding_model)
                if hasattr(embedding, "tolist"):
                    return embedding.tolist()
                elif isinstance(embedding, list):
                    return embedding
            except Exception as e:
                logger.warning(f"Hugging Face InferenceClient feature extraction error: {e}")

        # Attempt 2: Direct REST router request if key is provided
        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    resp = await http_client.post(
                        f"https://router.huggingface.co/hf-inference/models/{self.embedding_model}/pipeline/feature-extraction",
                        headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                        json={"inputs": clean_text},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                            return data[0]
                        elif isinstance(data, list):
                            return data
            except Exception as e:
                logger.warning(f"Hugging Face REST embedding error: {e}")

        # Fallback to OpenAI embedding service (already configured and active in the platform)
        try:
            from app.services.pinecone_service import get_pinecone_service
            pinecone_svc = get_pinecone_service()
            return await pinecone_svc.get_embedding(clean_text)
        except Exception:
            return None

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 1200,
        temperature: float = 0.3,
    ) -> Optional[str]:
        """
        Generates structured chat response using Meta Llama / Mistral via Hugging Face.
        """
        client = self._get_client()

        # Attempt 1: via official InferenceClient chat completions
        if client and self.is_configured:
            try:
                response = client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                if response and response.choices and len(response.choices) > 0:
                    return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"Hugging Face InferenceClient chat completion error: {e}")

        # Attempt 2: via REST chat completions endpoint
        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=25.0) as http_client:
                    resp = await http_client.post(
                        f"https://router.huggingface.co/hf-inference/models/{self.model_name}/v1/chat/completions",
                        headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                        json={
                            "model": self.model_name,
                            "messages": messages,
                            "max_tokens": max_tokens,
                            "temperature": temperature,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.warning(f"Hugging Face REST chat completion error: {e}")

        return None

    def get_status(self) -> Dict[str, Any]:
        """
        Returns Hugging Face API integration status.
        """
        return {
            "configured": self.is_configured,
            "has_hub_library": HAS_HF_HUB,
            "llm_model": self.model_name,
            "embedding_model": self.embedding_model,
            "status": "ready" if self.is_configured else "awaiting_user_token",
            "provider": "Hugging Face (Meta Llama & Sentence-Transformers)",
        }


_hf_service_instance: Optional[HuggingFaceService] = None


def get_huggingface_service() -> HuggingFaceService:
    global _hf_service_instance
    if _hf_service_instance is None:
        _hf_service_instance = HuggingFaceService()
    return _hf_service_instance

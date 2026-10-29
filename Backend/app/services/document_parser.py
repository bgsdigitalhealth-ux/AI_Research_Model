import io
import base64
from typing import Any, Dict, List, Tuple
import pymupdf as fitz
from docx import Document as DocxDocument
from app.core.exceptions import FileValidationError


class DocumentParserService:
    @staticmethod
    def is_image_file(filename: str) -> bool:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        return ext in ("png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif")

    @staticmethod
    def get_image_data_uri(content: bytes, filename: str) -> str:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
        mime = f"image/{ext}" if ext != "jpg" else "image/jpeg"
        b64 = base64.b64encode(content).decode("utf-8")
        return f"data:{mime};base64,{b64}"

    @staticmethod
    def parse_pdf(content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parses PDF bytes using PyMuPDF.
        Returns: (full_text, pages_metadata_list)
        where each page has page_number (1-indexed), text snippet, and character length.
        """
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            pages_meta = []
            full_text_parts = []

            for page_idx in range(len(doc)):
                page = doc[page_idx]
                page_text = page.get_text() or ""
                page_num = page_idx + 1

                pages_meta.append({
                    "page_number": page_num,
                    "text": page_text,
                    "char_count": len(page_text),
                })
                full_text_parts.append(f"--- PAGE {page_num} ---\n{page_text}")

            doc.close()
            return "\n\n".join(full_text_parts), pages_meta
        except Exception as exc:
            raise FileValidationError(f"Failed to parse PDF document text: {str(exc)}") from exc

    @staticmethod
    def parse_docx(content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parses DOCX bytes using python-docx.
        Returns: (full_text, paragraphs_metadata_list)
        where each entry has paragraph_number (1-indexed) and text snippet.
        """
        try:
            doc_stream = io.BytesIO(content)
            doc = DocxDocument(doc_stream)
            paragraphs_meta = []
            full_text_parts = []

            para_idx = 1
            for p in doc.paragraphs:
                text = p.text.strip()
                if text:
                    paragraphs_meta.append({
                        "paragraph_number": para_idx,
                        "text": text,
                        "char_count": len(text),
                    })
                    full_text_parts.append(f"[¶ {para_idx}] {text}")
                    para_idx += 1

            # Also inspect tables in docx
            for table_idx, table in enumerate(doc.tables, 1):
                table_text = []
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    table_text.append(" | ".join(row_data))
                if table_text:
                    table_block = "\n".join(table_text)
                    paragraphs_meta.append({
                        "paragraph_number": para_idx,
                        "section_title": f"Table {table_idx}",
                        "text": table_block,
                        "char_count": len(table_block),
                    })
                    full_text_parts.append(f"[Table {table_idx}]\n{table_block}")
                    para_idx += 1

            return "\n\n".join(full_text_parts), paragraphs_meta
        except Exception as exc:
            raise FileValidationError(f"Failed to parse DOCX document text: {str(exc)}") from exc

    @staticmethod
    def parse_excel(content: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parses XLSX / XLS workbook sheets using pandas & openpyxl.
        """
        import pandas as pd
        try:
            excel_file = pd.ExcelFile(io.BytesIO(content))
            sheet_parts = []
            meta_list = []

            for sheet_name in excel_file.sheet_names:
                df = excel_file.parse(sheet_name)
                df = df.dropna(how="all")
                if not df.empty:
                    csv_representation = df.to_csv(index=False)
                    sheet_parts.append(f"--- SHEET: {sheet_name} ---\n{csv_representation}")
                    meta_list.append({
                        "sheet_name": sheet_name,
                        "rows": len(df),
                        "columns": list(df.columns),
                    })

            return "\n\n".join(sheet_parts), meta_list
        except Exception as exc:
            raise FileValidationError(f"Failed to parse Excel file '{filename}': {str(exc)}") from exc

    @staticmethod
    def parse_csv(content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parses CSV data into formatted text.
        """
        try:
            text_str = content.decode("utf-8", errors="replace")
            return text_str, [{"rows": len(text_str.splitlines())}]
        except Exception as exc:
            raise FileValidationError(f"Failed to parse CSV file: {str(exc)}") from exc

    @classmethod
    def parse_document(cls, filename: str, content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Routes parsing to the appropriate engine based on file extension.
        """
        lower = filename.lower()
        if lower.endswith(".pdf"):
            return cls.parse_pdf(content)
        elif lower.endswith(".docx"):
            return cls.parse_docx(content)
        elif lower.endswith((".xlsx", ".xls")):
            return cls.parse_excel(content, filename)
        elif lower.endswith(".csv"):
            return cls.parse_csv(content)
        else:
            raise FileValidationError(f"Unsupported document format for text extraction: '{filename}'")

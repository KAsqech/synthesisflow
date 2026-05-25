from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import pandas as pd
import io
import math
import base64
import os
import json

from typing import Dict, List, Any
from dotenv import load_dotenv
from openai import OpenAI

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")

client = (
    OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    if api_key
    else None
)

app = FastAPI(title="SynthesisFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_PREVIEW_ROWS = 25


def clean_cell(value):
    if pd.isna(value):
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def normalize_text(value):
    if pd.isna(value):
        return "NR"
    value = str(value).strip()
    return value if value else "NR"


def read_uploaded_file(file: UploadFile) -> pd.DataFrame:
    filename = file.filename.lower()
    content = file.file.read()

    try:
        if filename.endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))

        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            return pd.read_excel(io.BytesIO(content))

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a CSV or Excel file.",
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")


def detect_year_column(columns: List[str]) -> str | None:
    for col in columns:
        lowered = col.lower()
        if "year" in lowered or "publication" in lowered:
            return col
    return None


def distribution(df: pd.DataFrame, column: str) -> List[Dict[str, Any]]:
    if column not in df.columns:
        return []

    total = len(df)

    values = (
        df[column]
        .apply(normalize_text)
        .value_counts(dropna=False)
        .head(20)
        .reset_index()
    )

    values.columns = ["category", "count"]

    values["percentage"] = values["count"].apply(
        lambda x: round((x / total) * 100, 1) if total else 0
    )

    return values.to_dict(orient="records")


def multi_category_distribution(df: pd.DataFrame, column: str) -> Dict[str, Any]:
    if column not in df.columns:
        return {
            "column": column,
            "categories": [],
            "total_assignments": 0,
            "study_count": len(df),
            "has_overlaps": False,
        }

    rows = []

    for value in df[column].apply(normalize_text):
        parts = (
            value.replace("|", ";")
            .replace("/", ";")
            .replace(",", ";")
            .split(";")
        )

        cleaned = [p.strip() for p in parts if p.strip()]
        rows.append(cleaned or ["NR"])

    flattened = [item for sublist in rows for item in sublist]
    total_assignments = len(flattened)
    study_count = len(df)

    counts = pd.Series(flattened).value_counts().head(20).reset_index()
    counts.columns = ["category", "count"]

    counts["percentage_of_studies"] = counts["count"].apply(
        lambda x: round((x / study_count) * 100, 1) if study_count else 0
    )

    return {
        "column": column,
        "categories": counts.to_dict(orient="records"),
        "total_assignments": total_assignments,
        "study_count": study_count,
        "has_overlaps": total_assignments > study_count,
    }


def generate_analytics(df: pd.DataFrame, analysis_columns: List[str]) -> Dict[str, Any]:
    return {
        "single_category_distributions": {
            column: distribution(df, column) for column in analysis_columns
        },
        "multi_category_distributions": {
            column: multi_category_distribution(df, column) for column in analysis_columns
        },
    }


def generate_quality_checks(df: pd.DataFrame, analysis_columns: List[str]) -> List[Dict[str, str]]:
    warnings = []
    total_rows = len(df)

    if total_rows == 0:
        warnings.append({
            "type": "empty_file",
            "severity": "high",
            "message": "The uploaded file has no rows.",
        })
        return warnings

    for column in analysis_columns:
        missing_count = (
            df[column].isna().sum()
            + (df[column].astype(str).str.strip() == "").sum()
        )

        missing_pct = round((missing_count / total_rows) * 100, 1)

        if missing_count > 0:
            warnings.append({
                "type": "missing_values",
                "severity": "medium",
                "message": f"{column} has {missing_count} missing/blank values ({missing_pct}%).",
            })

    year_column = detect_year_column(list(df.columns))

    if year_column:
        invalid_years = 0

        for value in df[year_column]:
            try:
                year = int(value)
                if year < 1900 or year > 2100:
                    invalid_years += 1
            except Exception:
                invalid_years += 1

        if invalid_years > 0:
            warnings.append({
                "type": "invalid_year",
                "severity": "medium",
                "message": f"{year_column} has {invalid_years} values that do not look like valid years.",
            })

    for column in analysis_columns:
        multi = multi_category_distribution(df, column)

        if multi["has_overlaps"]:
            warnings.append({
                "type": "multi_category_overlap",
                "severity": "info",
                "message": (
                    f"{column} contains {multi['total_assignments']} category assignments "
                    f"across {multi['study_count']} rows. Percentages may exceed 100%."
                ),
            })

    return warnings


def fig_to_base64() -> str:
    buffer = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buffer, format="png", dpi=200, bbox_inches="tight")
    plt.close()
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def make_bar_chart(df: pd.DataFrame, column: str):
    if column not in df.columns:
        return None

    counts = df[column].apply(normalize_text).value_counts().head(15)

    if counts.empty:
        return None

    plt.figure(figsize=(9, 5))
    counts.sort_values().plot(kind="barh")
    plt.title(column)
    plt.xlabel("Number of Rows")
    plt.ylabel("")
    return fig_to_base64()


def make_year_chart(df: pd.DataFrame, year_column: str):
    if year_column not in df.columns:
        return None

    years = pd.to_numeric(df[year_column], errors="coerce").dropna().astype(int)
    counts = years.value_counts().sort_index()

    if counts.empty:
        return None

    plt.figure(figsize=(8, 5))
    counts.plot(kind="bar")
    plt.title(f"Records by {year_column}")
    plt.xlabel(year_column)
    plt.ylabel("Number of Rows")
    return fig_to_base64()


def make_stacked_year_chart(df: pd.DataFrame, year_column: str, category_col: str):
    if year_column not in df.columns or category_col not in df.columns:
        return None

    temp = df[[year_column, category_col]].copy()
    temp[year_column] = pd.to_numeric(temp[year_column], errors="coerce")
    temp = temp.dropna(subset=[year_column])
    temp[year_column] = temp[year_column].astype(int)
    temp[category_col] = temp[category_col].apply(normalize_text)

    if temp.empty:
        return None

    grouped = (
        temp.groupby([year_column, category_col])
        .size()
        .unstack(fill_value=0)
        .sort_index()
    )

    top_categories = temp[category_col].value_counts().head(8).index
    grouped = grouped[[col for col in top_categories if col in grouped.columns]]

    if grouped.empty:
        return None

    grouped.plot(kind="bar", stacked=True, figsize=(10, 6))
    plt.title(f"{category_col} by {year_column}")
    plt.xlabel(year_column)
    plt.ylabel("Number of Rows")
    plt.legend(title=category_col, bbox_to_anchor=(1.05, 1), loc="upper left")
    return fig_to_base64()


def generate_figures(df: pd.DataFrame, analysis_columns: List[str]):
    figures = []
    year_column = detect_year_column(list(df.columns))

    if year_column:
        year_fig = make_year_chart(df, year_column)

        if year_fig:
            figures.append({
                "title": f"Records by {year_column}",
                "filename": f"records_by_{year_column.lower().replace(' ', '_')}.png",
                "image_base64": year_fig,
            })

    for column in analysis_columns[:8]:
        fig = make_bar_chart(df, column)

        if fig:
            figures.append({
                "title": column,
                "filename": f"{column.lower().replace(' ', '_')}.png",
                "image_base64": fig,
            })

    if year_column:
        non_year_columns = [col for col in analysis_columns if col != year_column]

        for column in non_year_columns[:4]:
            fig = make_stacked_year_chart(df, year_column, column)

            if fig:
                figures.append({
                    "title": f"{column} by {year_column}",
                    "filename": f"{column.lower().replace(' ', '_')}_by_{year_column.lower().replace(' ', '_')}.png",
                    "image_base64": fig,
                })

    return figures


def build_stats_payload(df, analytics, quality_checks, analysis_columns):
    return {
        "total_rows": len(df),
        "columns_analyzed": analysis_columns,
        "single_category_distributions": analytics["single_category_distributions"],
        "multi_category_distributions": analytics["multi_category_distributions"],
        "quality_checks": quality_checks,
    }


def generate_results_text(stats_payload: Dict[str, Any]) -> Dict[str, Any]:
    fallback = {
        "results_summary": "Text generation is currently disabled because no OpenRouter API key is configured.",
        "figure_legends": [],
        "appendix_notes": [],
        "consistency_note": "",
        "methods_note": "All counts and percentages were computed deterministically from the uploaded extraction sheet.",
    }

    if client is None:
        return fallback

    prompt = f"""
You are generating manuscript-ready text for an evidence synthesis project.

Use ONLY the statistics provided below.
Do not invent details.
Do not infer outcomes or significance.
Use counts and percentages exactly as provided.
Mention when multi-category assignments can exceed 100%.
Use cautious academic language.

Return valid JSON with exactly:
- results_summary
- figure_legends
- appendix_notes
- consistency_note
- methods_note

Statistics:
{json.dumps(stats_payload, indent=2)}
"""

    try:
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat-v3-0324:free",
            messages=[
                {
                    "role": "system",
                    "content": "You generate cautious academic Results text using only provided statistics.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        fallback["results_summary"] = f"Could not generate AI Results text: {str(e)}"
        return fallback


def build_export_text(generated_text: Dict[str, Any], quality_checks: List[Dict[str, str]]) -> str:
    lines = []

    lines.append("RESULTS SUMMARY")
    lines.append("=" * 60)
    lines.append(generated_text.get("results_summary", ""))

    lines.append("\nCONSISTENCY NOTE")
    lines.append("=" * 60)
    lines.append(generated_text.get("consistency_note", ""))

    lines.append("\nMETHODS NOTE")
    lines.append("=" * 60)
    lines.append(generated_text.get("methods_note", ""))

    lines.append("\nFIGURE LEGENDS")
    lines.append("=" * 60)
    for i, legend in enumerate(generated_text.get("figure_legends", []), 1):
        lines.append(f"{i}. {legend}")

    lines.append("\nAPPENDIX / TABLE NOTES")
    lines.append("=" * 60)
    for i, note in enumerate(generated_text.get("appendix_notes", []), 1):
        lines.append(f"{i}. {note}")

    lines.append("\nQUALITY CHECKS")
    lines.append("=" * 60)
    if not quality_checks:
        lines.append("No quality issues detected.")
    else:
        for check in quality_checks:
            lines.append(f"- [{check['severity']}] {check['message']}")

    return "\n".join(lines)


@app.get("/")
def health_check():
    return {"status": "ok", "product": "SynthesisFlow"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    df = read_uploaded_file(file)

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    df.columns = [str(col).strip() for col in df.columns]

    analysis_columns = list(df.columns)

    preview_df = df.head(MAX_PREVIEW_ROWS).copy()
    preview_df = preview_df.map(clean_cell)

    analytics = generate_analytics(df, analysis_columns)
    quality_checks = generate_quality_checks(df, analysis_columns)
    figures = generate_figures(df, analysis_columns)

    stats_payload = build_stats_payload(df, analytics, quality_checks, analysis_columns)
    generated_text = generate_results_text(stats_payload)
    export_text = build_export_text(generated_text, quality_checks)

    return {
        "filename": file.filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": list(df.columns),
        "analysis_columns": analysis_columns,
        "required_columns": [],
        "missing_columns": [],
        "is_valid_schema": True,
        "preview": preview_df.to_dict(orient="records"),
        "analytics": analytics,
        "quality_checks": quality_checks,
        "figures": figures,
        "generated_text": generated_text,
        "export_text": export_text,
    }
"use client";

import { useState } from "react";

type DistributionRow = {
  category: string;
  count: number;
  percentage?: number;
  percentage_of_studies?: number;
};

type QualityCheck = {
  type: string;
  severity: string;
  message: string;
};

type FigureOutput = {
  title: string;
  filename: string;
  image_base64: string;
};

type GeneratedText = {
  results_summary: string;
  figure_legends: string[];
  appendix_notes: string[];
  consistency_note?: string;
  methods_note?: string;
};

type UploadResponse = {
  filename: string;
  row_count: number;
  column_count: number;
  columns: string[];
  analysis_columns: string[];
  required_columns: string[];
  missing_columns: string[];
  is_valid_schema: boolean;
  preview: Record<string, string>[];
  analytics: {
    single_category_distributions: Record<string, DistributionRow[]>;
    multi_category_distributions: Record<
      string,
      {
        column: string;
        categories: DistributionRow[];
        total_assignments: number;
        study_count: number;
        has_overlaps: boolean;
      }
    >;
  };
  quality_checks: QualityCheck[];
  figures: FigureOutput[];
  generated_text: GeneratedText;
  export_text: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      setError("Please choose a CSV or Excel file.");
      return;
    }

    setError("");
    setData(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || "Upload failed.");
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function downloadText() {
    if (!data) return;

    const blob = new Blob([data.export_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "synthesisflow_results_export.txt";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-8 py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            SynthesisFlow Beta
          </p>

          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
            Turn evidence synthesis spreadsheets into publication-ready outputs.
          </h1>

          <p className="mt-5 max-w-3xl text-lg text-slate-600">
            Upload any CSV or Excel extraction sheet. SynthesisFlow detects your
            columns dynamically and generates analytics, quality checks, figures,
            and manuscript-style text.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-4">
            <FeatureCard title="Dynamic schema" text="Works with changing CSV and Excel columns." />
            <FeatureCard title="Analyze" text="Counts, percentages, and distributions." />
            <FeatureCard title="Visualize" text="Downloadable publication-style figures." />
            <FeatureCard title="Draft" text="Results text generated from computed statistics." />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-8 py-8">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Upload Extraction Sheet</h2>

          <p className="mt-2 text-sm text-slate-600">
            Upload any CSV/XLSX file. The app will detect and analyze all columns.
          </p>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-5 block w-full text-sm"
          />

          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-white disabled:opacity-50"
          >
            {loading ? "Generating outputs..." : "Upload and Generate"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {data && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-semibold">Generated Output Package</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Download the manuscript text package and individual figures.
                  </p>
                </div>

                <button
                  onClick={downloadText}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm text-white"
                >
                  Download Text Export
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">File Summary</h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoCard label="Filename" value={data.filename} />
                <InfoCard label="Rows" value={String(data.row_count)} />
                <InfoCard label="Columns" value={String(data.column_count)} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Detected Columns</h2>

              <p className="mt-2 text-sm text-slate-600">
                This file has {data.column_count} columns. SynthesisFlow analyzed
                all detected columns.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {data.columns.map((col) => (
                  <span
                    key={col}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Generated Results Text</h2>

              <TextBlock
                title="Results Summary"
                text={data.generated_text.results_summary}
              />

              {data.generated_text.consistency_note && (
                <TextBlock
                  title="Consistency Note"
                  text={data.generated_text.consistency_note}
                />
              )}

              {data.generated_text.methods_note && (
                <TextBlock
                  title="Methods Note"
                  text={data.generated_text.methods_note}
                />
              )}

              {data.generated_text.figure_legends.length > 0 && (
                <ListBlock
                  title="Figure Legends"
                  items={data.generated_text.figure_legends}
                />
              )}

              {data.generated_text.appendix_notes.length > 0 && (
                <ListBlock
                  title="Appendix / Table Notes"
                  items={data.generated_text.appendix_notes}
                />
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Quality Checks</h2>

              {data.quality_checks.length === 0 ? (
                <p className="mt-3 rounded-lg bg-green-50 p-3 text-green-700">
                  No quality issues detected.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.quality_checks.map((check, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-medium capitalize">
                        {check.severity}: {check.type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-slate-700">{check.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Generated Figures</h2>

              {data.figures.length === 0 ? (
                <p className="mt-3 text-slate-600">No figures generated.</p>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-8">
                  {data.figures.map((fig) => (
                    <div key={fig.filename} className="rounded-xl border p-4">
                      <h3 className="font-semibold">{fig.title}</h3>

                      <img
                        src={`data:image/png;base64,${fig.image_base64}`}
                        alt={fig.title}
                        className="mt-4 w-full rounded-lg border bg-white"
                      />

                      <a
                        href={`data:image/png;base64,${fig.image_base64}`}
                        download={fig.filename}
                        className="mt-4 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
                      >
                        Download PNG
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Analytics Tables</h2>

              <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                {Object.entries(data.analytics.single_category_distributions).map(
                  ([column, rows]) => (
                    <DistributionTable
                      key={column}
                      title={column}
                      rows={rows}
                      percentageKey="percentage"
                    />
                  )
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Multi-Category Checks</h2>

              <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                {Object.entries(data.analytics.multi_category_distributions).map(
                  ([column, info]) => (
                    <div key={column} className="rounded-xl border p-4">
                      <h3 className="font-semibold">{column}</h3>

                      <p className="mt-2 text-sm text-slate-600">
                        {info.total_assignments} assignments across {info.study_count} rows.
                      </p>

                      {info.has_overlaps && (
                        <p className="mt-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700">
                          Percentages may exceed 100% because rows can have multiple categories.
                        </p>
                      )}

                      <DistributionTable
                        title=""
                        rows={info.categories}
                        percentageKey="percentage_of_studies"
                      />
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Data Preview</h2>

              {data.preview.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        {Object.keys(data.preview[0]).map((col) => (
                          <th
                            key={col}
                            className="border px-3 py-2 text-left font-medium"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {data.preview.map((row, idx) => (
                        <tr key={idx}>
                          {Object.keys(data.preview[0]).map((col) => (
                            <td key={col} className="border px-3 py-2">
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-slate-600">No preview available.</p>
              )}
            </section>
          </div>
        )}

        <section className="mt-10 rounded-2xl bg-slate-950 p-8 text-white">
          <h2 className="text-2xl font-bold">Launching beta pilots</h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            SynthesisFlow is designed for students, PhDs, clinicians, and labs
            working on scoping reviews, systematic reviews, evidence maps, and
            research synthesis projects.
          </p>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-xl border bg-slate-50 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-slate-800">{text}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-xl border p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-800">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DistributionTable({
  title,
  rows,
  percentageKey,
}: {
  title: string;
  rows: DistributionRow[];
  percentageKey: "percentage" | "percentage_of_studies";
}) {
  return (
    <div className="mt-3 rounded-xl border p-4">
      {title && <h3 className="font-semibold">{title}</h3>}

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No data available.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-right">Count</th>
              <th className="px-2 py-2 text-right">%</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="border-b">
                <td className="px-2 py-2">{row.category}</td>
                <td className="px-2 py-2 text-right">{row.count}</td>
                <td className="px-2 py-2 text-right">
                  {row[percentageKey] ?? 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
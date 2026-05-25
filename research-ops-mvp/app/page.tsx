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

type UploadResponse = {
  filename: string;
  row_count: number;
  column_count: number;
  columns: string[];
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

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Evidence Synthesis Analytics MVP
        </h1>

        <p className="mt-2 text-gray-600">
          Upload an extraction sheet to validate schema, preview data, generate analytics, and create publication-style figures.
        </p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />

          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-4 rounded-xl bg-black px-5 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Upload and Analyze"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {data && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">File Summary</h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoCard label="Filename" value={data.filename} />
                <InfoCard label="Rows" value={String(data.row_count)} />
                <InfoCard label="Columns" value={String(data.column_count)} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Schema Validation</h2>

              {data.is_valid_schema ? (
                <p className="mt-3 rounded-lg bg-green-50 p-3 text-green-700">
                  Valid schema. All required columns are present.
                </p>
              ) : (
                <div className="mt-3 rounded-lg bg-yellow-50 p-3 text-yellow-800">
                  <p className="font-medium">Missing columns:</p>
                  <ul className="mt-2 list-disc pl-5">
                    {data.missing_columns.map((col) => (
                      <li key={col}>{col}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-sm text-gray-600">
                Required columns: {data.required_columns.join(", ")}
              </p>
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
                      className="rounded-lg border bg-gray-50 p-3 text-sm"
                    >
                      <p className="font-medium capitalize">
                        {check.severity}: {check.type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-gray-700">{check.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Generated Figures</h2>

              {data.figures.length === 0 ? (
                <p className="mt-3 text-gray-600">No figures generated.</p>
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
                        className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm text-white"
                      >
                        Download PNG
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">Single-Category Distributions</h2>

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

                      <p className="mt-2 text-sm text-gray-600">
                        {info.total_assignments} assignments across {info.study_count} studies.
                      </p>

                      {info.has_overlaps && (
                        <p className="mt-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700">
                          This field contains overlapping categories, so percentages may exceed 100%.
                        </p>
                      )}

                      <div className="mt-3">
                        <DistributionTable
                          title=""
                          rows={info.categories}
                          percentageKey="percentage_of_studies"
                        />
                      </div>
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
                    <thead className="bg-gray-100">
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
                <p className="mt-3 text-gray-600">No preview available.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-100 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
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
    <div className="rounded-xl border p-4">
      {title && <h3 className="font-semibold">{title}</h3>}

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No data available.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
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
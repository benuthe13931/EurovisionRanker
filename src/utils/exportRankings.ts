import type { Song } from "../types";

export type RankingExportSection = {
  title: string;
  createdAt?: string | null;
  notes?: string | null;
  songs: Song[];
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formattedDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadFile(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportRankingHtml(
  title: string,
  sections: RankingExportSection[],
) {
  const generatedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const body = sections
    .map(
      (section) => `
        <section>
          <header class="section-header">
            <div>
              <h2>${escapeHtml(section.title)}</h2>
              ${
                section.createdAt
                  ? `<p>Saved ${escapeHtml(formattedDate(section.createdAt))}</p>`
                  : ""
              }
            </div>
            <strong>${section.songs.length} songs</strong>
          </header>
          ${
            section.notes
              ? `<p class="notes">${escapeHtml(section.notes)}</p>`
              : ""
          }
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Song</th>
                <th>Artist</th>
                <th>Country</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              ${section.songs
                .map(
                  (song, index) => `
                    <tr>
                      <td class="rank">${index + 1}</td>
                      <td>${escapeHtml(song.title)}</td>
                      <td>${escapeHtml(song.artist)}</td>
                      <td>${escapeHtml(song.country)}</td>
                      <td>${escapeHtml(song.year ?? "")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color: #191722;
      background: #f7f3fb;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 32px;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
    }
    .cover {
      padding: 26px 28px;
      border-radius: 14px;
      color: white;
      background: linear-gradient(135deg, #27103d, #0d6372);
      box-shadow: 0 18px 50px rgba(30, 14, 54, 0.18);
    }
    h1, h2, p {
      margin: 0;
    }
    h1 {
      font-size: 2rem;
      line-height: 1.1;
    }
    .cover p {
      margin-top: 8px;
      color: rgba(255, 255, 255, 0.74);
    }
    section {
      margin-top: 22px;
      padding: 20px;
      border: 1px solid rgba(31, 26, 44, 0.1);
      border-radius: 12px;
      background: white;
      box-shadow: 0 10px 30px rgba(28, 20, 43, 0.08);
    }
    .section-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }
    .section-header h2 {
      font-size: 1.25rem;
    }
    .section-header p,
    .notes {
      color: #6f667c;
      line-height: 1.45;
    }
    .notes {
      margin: -2px 0 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 10px;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid #ece7f3;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: #63586f;
      background: #f2edf8;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:nth-child(even) td {
      background: #fbf8fe;
    }
    .rank {
      width: 54px;
      color: #0d6372;
      font-weight: 800;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      section,
      .cover {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="cover">
      <h1>${escapeHtml(title)}</h1>
      <p>Exported ${escapeHtml(generatedAt)}</p>
    </header>
    ${body}
  </main>
</body>
</html>`;

  downloadFile(
    `${safeFilename(title || "ranking-export")}.html`,
    "text/html;charset=utf-8",
    html,
  );
}

export function exportRankingCsv(
  title: string,
  sections: RankingExportSection[],
) {
  const rows = [
    [
      "Export",
      "Section",
      "Section Saved At",
      "Rank",
      "Song ID",
      "Song",
      "Artist",
      "Country",
      "Country Code",
      "Year",
      "Notes",
    ],
  ];

  sections.forEach((section) => {
    section.songs.forEach((song, index) => {
      rows.push([
        title,
        section.title,
        formattedDate(section.createdAt),
        String(index + 1),
        song.id,
        song.title,
        song.artist,
        song.country,
        song.countryCode,
        String(song.year ?? ""),
        section.notes ?? "",
      ]);
    });
  });

  downloadFile(
    `${safeFilename(title || "ranking-export")}.csv`,
    "text/csv;charset=utf-8",
    rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
  );
}

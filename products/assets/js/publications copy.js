document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("publications-list");
  const searchInput = document.getElementById("pub-search");
  const yearFilter = document.getElementById("pub-year-filter");

  if (!list || !searchInput || !yearFilter) return;

  let publications = [];

  try {
    const response = await fetch("../../assets/data/publications.json");
    publications = await response.json();
  } catch (error) {
    list.innerHTML = "<p>Could not load publications database.</p>";
    return;
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getYear(item) {
    return item.issued?.["date-parts"]?.[0]?.[0] || "";
  }

  function getAuthors(item) {
    if (!Array.isArray(item.author)) return "";

    return item.author
      .map(author => {
        const given = author.given || "";
        const family = author.family || "";
        return `${given} ${family}`.trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  function getJournal(item) {
    return item["container-title"] || item.publisher || item.source || "";
  }

  function getDoi(item) {
    if (!item.DOI) return "";

    return String(item.DOI)
      .replace(/^https?:\/\/doi\.org\//i, "")
      .trim();
  }

  function getUrl(item) {
    if (item.URL) return item.URL;

    const doi = getDoi(item);
    if (doi) return `https://doi.org/${doi}`;

    return "";
  }

  function getTags(item) {
    if (Array.isArray(item.keyword)) return item.keyword;

    if (typeof item.keyword === "string") {
      return item.keyword
        .split(/[,;]/)
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    if (Array.isArray(item.tags)) return item.tags;

    return [];
  }

  function getPublicationType(item) {
    const typeMap = {
      "article-journal": "Journal article",
      "paper-conference": "Conference paper",
      "chapter": "Book chapter",
      "book": "Book",
      "thesis": "Thesis",
      "report": "Report",
      "webpage": "Web page",
      "article": "Article"
    };

    return typeMap[item.type] || item.type || "";
  }

  function getSearchText(item) {
    return [
      item.title,
      getAuthors(item),
      getYear(item),
      getJournal(item),
      getDoi(item),
      item.abstract,
      item.source,
      item.publisher,
      getPublicationType(item),
      ...getTags(item)
    ]
      .join(" ")
      .toLowerCase();
  }


  publications = publications.filter(item => getDoi(item));

  publications.sort((a, b) => {
    const yearA = Number(getYear(a)) || 0;
    const yearB = Number(getYear(b)) || 0;
    return yearB - yearA;
  });

  const years = [
    ...new Set(
      publications
        .map(item => getYear(item))
        .filter(Boolean)
    )
  ].sort((a, b) => b - a);

  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });

  function render() {
    const query = searchInput.value.toLowerCase();
    const selectedYear = yearFilter.value;

    const filtered = publications.filter(item => {
      const matchesSearch = getSearchText(item).includes(query);
      const matchesYear = !selectedYear || String(getYear(item)) === selectedYear;

      return matchesSearch && matchesYear;
    });

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="publication-count">
          0 publications
        </div>

        <p>No publications found.</p>
      `;
      return;
    }

    list.innerHTML = `
      <div class="publication-count">
        ${filtered.length} publication${filtered.length !== 1 ? "s" : ""}
      </div>

      ${filtered.map(item => {
      const title = escapeHtml(item.title || "Untitled publication");
      const authors = escapeHtml(getAuthors(item));
      const year = escapeHtml(getYear(item));
      const journal = escapeHtml(getJournal(item));
      const doi = escapeHtml(getDoi(item));
      const url = escapeHtml(getUrl(item));
      const type = escapeHtml(getPublicationType(item));
      const abstract = escapeHtml(item.abstract || "");
      const tags = getTags(item);

      return `
        <article class="publication-card">
          <div class="publication-year">${year || "—"}</div>

          <div class="publication-content">
            <h2>${title}</h2>

            ${authors ? `<p class="publication-authors">${authors}</p>` : ""}
            ${journal ? `<p class="publication-journal">${journal}</p>` : ""}
            ${type ? `<p class="publication-note">${type}</p>` : ""}

            ${
              abstract
                ? `<details class="publication-abstract">
                    <summary>Abstract</summary>
                    <p>${abstract}</p>
                  </details>`
                : ""
            }

            ${
              tags.length
                ? `<div class="publication-tags">
                    ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
                  </div>`
                : ""
            }
          </div>

          <div class="publication-actions">
            ${
              url
                ? `<a href="${url}" target="_blank" rel="noopener">View publication</a>`
                : ""
            }

            ${
              doi
                ? `<small>DOI: ${doi}</small>`
                : ""
            }
          </div>
        </article>
      `;
    }).join("")}
    `;
  }

  searchInput.addEventListener("input", render);
  yearFilter.addEventListener("change", render);

  render();
});
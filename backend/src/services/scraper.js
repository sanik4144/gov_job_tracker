import axios from "axios";
import { env } from "../config/env.js";

const BASE_URL = "https://alljobs.teletalk.com.bd";
const API_BASE_URL = `${BASE_URL}/api/v1`;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function fetchGovtOrgJobs(page = 1, limit = 100) {
  const response = await axios.get(`${API_BASE_URL}/govt-jobs/org-list`, {
    timeout: 20000,
    params: { page, limit },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GovJobTracker/1.0)",
      Accept: "application/json",
    },
  });

  return response.data;
}

async function fetchGovtJobDetails(jobId) {
  const response = await axios.get(`${API_BASE_URL}/govt-jobs/public-details`, {
    timeout: 20000,
    params: { id: jobId },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GovJobTracker/1.0)",
      Accept: "application/json",
    },
  });

  return response.data?.details || null;
}

function findMatchedKeywords(job, keywords) {
  const title = normalizeText(job?.job_title).toLowerCase();
  return keywords.filter((keyword) => title.includes(keyword.toLowerCase()));
}

export async function fetchJobs(keywords = [env.jobKeyword]) {
  const activeKeywords = [...new Set(keywords.map(normalizeText).filter(Boolean))];
  if (activeKeywords.length === 0) return [];

  const byId = new Map();
  const limit = 20;
  let page = 1;
  let total = Infinity;
  let processed = 0;

  while (processed < total) {
    const data = await fetchGovtOrgJobs(page, limit);
    const orgJobs = data.govtOrgJobs || [];
    total = Number(data.count || orgJobs.length);

    for (const org of orgJobs) {
      for (const job of org.govt_jobs || []) {
        const matchedKeywords = findMatchedKeywords(job, activeKeywords);
        if (matchedKeywords.length === 0) continue;

        const details = await fetchGovtJobDetails(job.id);
        const title = normalizeText(details?.job_title || job.job_title);
        const externalId = normalizeText(details?.job_id) || `GOVT-${job.id}`;
        const organization = normalizeText(
          details?.job_utilities_govtorganization?.name || org.name
        );
        const detailUrl = `${BASE_URL}/jobs/government/${org.id}?jobId=${job.id}`;

        byId.set(externalId, {
          externalId,
          title,
          organization,
          deadline: formatDate(details?.deadline_date),
          detailUrl,
          sourceUrl: env.jobSearchUrl,
          keywords: matchedKeywords,
          rawText: normalizeText(
            [
              title,
              organization,
              details?.job_id,
              details?.vacancy ? `Vacancy: ${details.vacancy}` : "",
              details?.deadline_date ? `Deadline: ${details.deadline_date}` : "",
            ].join(" ")
          ),
        });
      }
    }

    if (orgJobs.length === 0) break;
    processed += orgJobs.length;
    page += 1;
  }

  return [...byId.values()];
}

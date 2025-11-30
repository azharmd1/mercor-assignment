require("dotenv").config();
const fetch = require("node-fetch");

const BASE_URL = "https://api.turbopuffer.com/v2";

async function searchVector(queryVector, topK = 50) {
  const res = await fetch(`${BASE_URL}/collections/linkedin_data_subset/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TURBOPUFFER_API_KEY
    },
    body: JSON.stringify({
      vector: queryVector,
      top_k: topK
    })
  });

  if (!res.ok) {
    console.error(await res.text());
    throw new Error("Turbopuffer vector search failed");
  }

  const data = await res.json();
  return data.matches || [];
}

async function getObjectById(id) {
  const res = await fetch(`${BASE_URL}/collections/linkedin_data_subset/rows/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TURBOPUFFER_API_KEY
    }
  });

  if (!res.ok) return null;
  return await res.json();
}

module.exports = {
  searchVector,
  getObjectById
};
